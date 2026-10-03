import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import type { AIAnalysisResponse } from '../../../../shared/src/schemas';
import { aiAnalysisResponseSchema } from '../../../../shared/src/schemas';
import type {
  IAIInsight,
  IAIInsightsResponse,
  IAnalyticsOverview,
  ICategoryDistribution,
} from '../../../../shared/src/types';

interface ComplaintContext {
  title: string;
  description: string;
  location: string;
  categories: Array<{ id: string; name: string; code: string }>;
  departments: Array<{ id: string; name: string; code: string }>;
}

interface AnalyticsContext {
  overview: IAnalyticsOverview;
  categoryDistribution: ICategoryDistribution[];
  topLocations: Array<{ location: string; count: number }>;
  recurringCategories: Array<{ name: string; count: number; trend: 'increasing' | 'stable' | 'decreasing' }>;
  overdueCount: number;
  period: { from: string; to: string };
}

class AIService {
  private apiKey: string | null = null;
  private isAvailable: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const rawKey = config.GEMINI_API_KEY?.trim();
    if (!rawKey) {
      logger.warn('⚠️ GEMINI_API_KEY is not set. Add your Gemini API key to the project-root .env file and restart the server.');
      this.isAvailable = false;
      this.apiKey = null;
      return;
    }

    this.apiKey = rawKey;
    this.isAvailable = true;
    logger.info(`✅ Gemini AI service initialized (model: ${config.GEMINI_MODEL})`);
  }

  /**
   * Call Gemini directly through Google's REST API.
   * This avoids SDK/model-version mismatches and works with current Gemini 3.x models.
   */
  private async generateContent(prompt: string, jsonMode = false): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.GEMINI_MODEL)}:generateContent`;
    const generationConfig: Record<string, unknown> = { maxOutputTokens: 1200 };
    if (jsonMode) generationConfig.responseMimeType = 'application/json';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });

    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`Gemini returned a non-JSON HTTP response (${response.status})`);
    }

    if (!response.ok) {
      const apiMessage = payload?.error?.message || `HTTP ${response.status}`;
      const apiStatus = payload?.error?.status ? ` (${payload.error.status})` : '';
      throw new Error(`Gemini API error: ${apiMessage}${apiStatus}`);
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text ?? '')
      .join('')
      .trim();

    if (!text) {
      const finishReason = payload?.candidates?.[0]?.finishReason || 'unknown';
      throw new Error(`Gemini returned no text content (finishReason: ${finishReason})`);
    }

    return text;
  }

  getAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Analyze a complaint using Gemini AI
   * Returns structured analysis or null on failure
   */
  async analyzeComplaint(context: ComplaintContext): Promise<AIAnalysisResponse | null> {
    if (!this.isAvailable || !this.apiKey) {
      logger.warn('AI not available, returning null for complaint analysis');
      return null;
    }

    const categoryList = context.categories
      .map((c) => `- "${c.name}" (code: ${c.code}, id: ${c.id})`)
      .join('\n');
    const departmentList = context.departments
      .map((d) => `- "${d.name}" (code: ${d.code}, id: ${d.id})`)
      .join('\n');

    const prompt = `You are an expert hostel complaint classification system. Your task is to analyze a student's hostel complaint and return structured JSON.

STUDENT COMPLAINT:
Title: ${context.title}
Description: ${context.description}
Location: ${context.location}

AVAILABLE CATEGORIES (you MUST use one of these exact names):
${categoryList}

AVAILABLE DEPARTMENTS (you MUST use one of these exact names):
${departmentList}

PRIORITY LEVELS: critical, high, medium, low

INSTRUCTIONS:
1. summary: Create a concise operational summary (1-2 sentences, max 150 words) describing the core issue
2. category: Choose the BEST matching category name from the list above. Use the exact name.
3. subCategory: A specific sub-type (e.g., "Water Leakage", "Electrical Short Circuit")
4. priority: Determine priority based on:
   - critical: Immediate safety/health risk, affects many people
   - high: Significant inconvenience, potential property damage, active leakage/flood
   - medium: Notable inconvenience, affects normal life
   - low: Minor inconvenience, cosmetic issues
5. department: Choose the BEST matching department name from the list above. Use the exact name.
6. possibleSafetyRisk: true if there is any safety/health risk
7. safetyReason: If safety risk, explain why (otherwise omit)
8. confidence: Your confidence level from 0.0 to 1.0
9. priorityReason: Brief explanation of why you assigned this priority

Return ONLY valid JSON matching this exact structure:
{
  "summary": "string",
  "category": "string (exact category name from list)",
  "subCategory": "string",
  "priority": "critical|high|medium|low",
  "department": "string (exact department name from list)",
  "possibleSafetyRisk": boolean,
  "safetyReason": "string or omit",
  "confidence": number,
  "priorityReason": "string"
}`;

    try {
      const text = await this.generateContent(prompt, true);
      
      // Parse and validate the response
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse JSON from AI response');
        }
      }

      const validated = aiAnalysisResponseSchema.safeParse(parsed);
      if (!validated.success) {
        logger.warn('AI response failed schema validation:', validated.error.format());
        return null;
      }

      // Validate that category and department exist in provided lists
      const categoryMatch = context.categories.find(
        (c) => c.name.toLowerCase() === validated.data.category.toLowerCase()
      );
      const departmentMatch = context.departments.find(
        (d) => d.name.toLowerCase() === validated.data.department.toLowerCase()
      );

      if (!categoryMatch) {
        logger.warn(`AI returned unknown category: ${validated.data.category}`);
        // Use the closest match or first category
        validated.data.category = context.categories[0]?.name ?? validated.data.category;
      }
      if (!departmentMatch) {
        logger.warn(`AI returned unknown department: ${validated.data.department}`);
        validated.data.department = context.departments[0]?.name ?? validated.data.department;
      }

      return validated.data;
    } catch (error) {
      logger.error('AI complaint analysis failed:', error);
      return null;
    }
  }

  /**
   * Generate text embeddings for semantic similarity
   * Falls back to simple TF-IDF style vector if AI unavailable
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Use simple bag-of-words style embedding as fallback
    // This gives a rough semantic similarity without needing embeddings API
    return this.simpleTextEmbedding(text);
  }

  /**
   * Generate hostel insights from aggregated analytics data
   */
  async generateInsights(context: AnalyticsContext): Promise<IAIInsightsResponse> {
    const defaultResponse: IAIInsightsResponse = {
      insights: [],
      generatedAt: new Date().toISOString(),
      dataPoints: context.overview.total,
      hasEnoughData: context.overview.total >= 5,
    };

    if (context.overview.total < 5) {
      defaultResponse.insights = [
        {
          id: 'insufficient_data',
          type: 'general',
          title: 'Insufficient Data for Analysis',
          summary: 'Not enough historical data for a reliable trend analysis. Continue using the system to generate meaningful insights.',
          confidence: 1.0,
          severity: 'info',
        },
      ];
      return defaultResponse;
    }

    // Build rule-based insights from actual data (without AI fabricating data)
    const ruleBasedInsights: IAIInsight[] = this.buildRuleBasedInsights(context);

    if (!this.isAvailable || !this.apiKey) {
      defaultResponse.insights = ruleBasedInsights;
      return defaultResponse;
    }

    // Use AI to explain the rule-based evidence
    try {
      const prompt = `You are a hostel management analyst. Based on the following REAL data from a hostel complaint system, generate actionable insights. You MUST only reference the data provided - never invent statistics.

REAL COMPLAINT DATA (period: ${context.period.from} to ${context.period.to}):
- Total complaints: ${context.overview.total}
- Resolved: ${context.overview.resolved + context.overview.closed}
- Overdue: ${context.overdueCount}
- Critical: ${context.overview.critical}, High: ${context.overview.high}, Medium: ${context.overview.medium}, Low: ${context.overview.low}
- Average resolution time: ${context.overview.avgResolutionTimeHours} hours
- Average satisfaction: ${context.overview.avgSatisfactionRating}/5

CATEGORY DISTRIBUTION:
${context.categoryDistribution.map((c) => `- ${c.categoryName}: ${c.count} complaints (${c.percentage.toFixed(1)}%)`).join('\n')}

RECURRING CATEGORIES (trending):
${context.recurringCategories.map((c) => `- ${c.name}: ${c.count} complaints, trend: ${c.trend}`).join('\n')}

Based ONLY on this data, generate 3-5 insights. Each insight must reference specific numbers from the data above.

Return JSON array:
[
  {
    "type": "recurring_issue|department_performance|priority_alert|resolution_time|general",
    "title": "concise title",
    "summary": "specific insight referencing actual numbers",
    "recommendation": "actionable recommendation",
    "confidence": 0.0-1.0,
    "severity": "info|warning|critical"
  }
]`;

      const text = await this.generateContent(prompt, true);

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          return { ...defaultResponse, insights: ruleBasedInsights };
        }
      }

      if (!Array.isArray(parsed)) {
        return { ...defaultResponse, insights: ruleBasedInsights };
      }

      const aiInsights: IAIInsight[] = (parsed as Array<{
        type?: string;
        title?: string;
        summary?: string;
        recommendation?: string;
        confidence?: number;
        severity?: string;
      }>)
        .filter((i) => i.title && i.summary)
        .map((i, idx) => ({
          id: `ai_insight_${idx}`,
          type: (i.type as IAIInsight['type']) || 'general',
          title: String(i.title),
          summary: String(i.summary),
          recommendation: i.recommendation ? String(i.recommendation) : undefined,
          confidence: typeof i.confidence === 'number' ? Math.min(1, Math.max(0, i.confidence)) : 0.8,
          severity: (i.severity as IAIInsight['severity']) || 'info',
          period: context.period,
        }));

      return {
        insights: [...ruleBasedInsights, ...aiInsights].slice(0, 8),
        generatedAt: new Date().toISOString(),
        dataPoints: context.overview.total,
        hasEnoughData: true,
      };
    } catch (error) {
      logger.error('AI insights generation failed:', error);
      return { ...defaultResponse, insights: ruleBasedInsights };
    }
  }

  /**
   * Answer student chat questions based on their complaint data
   */
  async answerChatQuery(
    query: string,
    studentContext: {
      name: string;
      complaints: Array<{ id: string; title: string; status: string; createdAt: string }>;
    }
  ): Promise<string> {
    if (!this.isAvailable || !this.apiKey) {
      return this.handleChatFallback(query, studentContext);
    }

    const complaintsText = studentContext.complaints
      .map((c) => `- ID: ${c.id}, Title: "${c.title}", Status: ${c.status}, Submitted: ${c.createdAt}`)
      .join('\n');

    const prompt = `You are HERA Assistant, a helpful hostel complaint management assistant. You can ONLY answer questions about the student's own complaints. You must NOT make up information.

STUDENT NAME: ${studentContext.name}

STUDENT'S COMPLAINTS:
${complaintsText || 'No complaints submitted yet.'}

STUDENT QUESTION: ${query}

INSTRUCTIONS:
- Answer only questions about hostel complaints and the complaint management process
- Only reference the student's actual complaints listed above
- If asked about another student's data, politely decline
- Be helpful, friendly, and concise
- If you don't have enough information to answer accurately, say so clearly
- Maximum 150 words in response

Response:`;

    try {
      const text = await this.generateContent(prompt, false);
      return text.trim();
    } catch (error) {
      logger.error('AI chat query failed:', error);
      return this.handleChatFallback(query, studentContext);
    }
  }

  private handleChatFallback(
    query: string,
    studentContext: { name: string; complaints: Array<{ id: string; title: string; status: string; createdAt: string }> }
  ): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('status') || lowerQuery.includes('complaint')) {
      if (studentContext.complaints.length === 0) {
        return "You haven't submitted any complaints yet. You can report a problem using the 'Report Problem' button on your dashboard.";
      }
      const latest = studentContext.complaints[0];
      return `Your most recent complaint "${latest.title}" currently has status: ${latest.status}. You can view all your complaints in the 'My Complaints' section.`;
    }

    if (lowerQuery.includes('how') && lowerQuery.includes('report')) {
      return "To report a hostel problem, click the 'Report Problem' button on your dashboard. Fill in the title, description, and location. Our AI system will automatically analyze and route your complaint to the right department.";
    }

    return "I'm here to help with your hostel complaint questions! You can ask about your complaint status, how to submit a complaint, or general information about the complaint process.";
  }

  /**
   * Generate rule-based insights from actual data without AI fabrication
   */
  private buildRuleBasedInsights(context: AnalyticsContext): IAIInsight[] {
    const insights: IAIInsight[] = [];

    // High overdue insight
    if (context.overdueCount > 0) {
      const severity: IAIInsight['severity'] =
        context.overdueCount > 10 ? 'critical' : context.overdueCount > 5 ? 'warning' : 'info';
      insights.push({
        id: 'overdue_complaints',
        type: 'priority_alert',
        title: `${context.overdueCount} Overdue Complaint${context.overdueCount > 1 ? 's' : ''} Require Attention`,
        summary: `There are currently ${context.overdueCount} complaints that have exceeded their resolution target. These need immediate attention to improve resolution performance.`,
        evidence: [{ metric: 'overdueComplaints', value: context.overdueCount, label: 'Overdue' }],
        recommendation: 'Review and escalate overdue complaints. Consider assigning additional resources to the affected departments.',
        confidence: 1.0,
        severity,
        period: context.period,
      });
    }

    // High priority complaints insight
    const highPriorityCount = context.overview.critical + context.overview.high;
    if (highPriorityCount > 0) {
      insights.push({
        id: 'high_priority_active',
        type: 'priority_alert',
        title: `${highPriorityCount} High/Critical Priority Complaints Active`,
        summary: `${context.overview.critical} critical and ${context.overview.high} high priority complaints are active. These represent urgent issues requiring immediate attention.`,
        evidence: [
          { metric: 'critical', value: context.overview.critical, label: 'Critical' },
          { metric: 'high', value: context.overview.high, label: 'High Priority' },
        ],
        recommendation: 'Ensure critical complaints have been assigned and are actively being worked on.',
        confidence: 1.0,
        severity: context.overview.critical > 0 ? 'critical' : 'warning',
        period: context.period,
      });
    }

    // Top category insight
    if (context.categoryDistribution.length > 0) {
      const top = context.categoryDistribution[0];
      if (top.percentage > 30) {
        insights.push({
          id: 'dominant_category',
          type: 'recurring_issue',
          title: `${top.categoryName} Dominates Complaint Volume`,
          summary: `${top.categoryName} accounts for ${top.percentage.toFixed(1)}% of all complaints (${top.count} total), which is significantly higher than other categories.`,
          evidence: [
            { metric: 'complaintCount', value: top.count, label: top.categoryName },
            { metric: 'percentage', value: `${top.percentage.toFixed(1)}%`, label: 'Share of total' },
          ],
          recommendation: `Consider a proactive maintenance inspection for ${top.categoryName} issues to reduce complaint volume.`,
          confidence: 0.9,
          severity: top.percentage > 50 ? 'warning' : 'info',
          period: context.period,
        });
      }
    }

    // Resolution time insight
    if (context.overview.avgResolutionTimeHours > 48) {
      insights.push({
        id: 'slow_resolution',
        type: 'resolution_time',
        title: 'Average Resolution Time Above Target',
        summary: `Current average resolution time is ${context.overview.avgResolutionTimeHours.toFixed(1)} hours, which exceeds the typical 48-hour target for medium priority complaints.`,
        evidence: [
          { metric: 'avgResolutionHours', value: context.overview.avgResolutionTimeHours, label: 'Avg Resolution Hours' },
        ],
        recommendation: 'Review department workflows and resource allocation to improve resolution speed.',
        confidence: 0.85,
        severity: context.overview.avgResolutionTimeHours > 96 ? 'warning' : 'info',
        period: context.period,
      });
    }

    // Trending categories
    const increasing = context.recurringCategories.filter((c) => c.trend === 'increasing');
    if (increasing.length > 0) {
      insights.push({
        id: 'increasing_categories',
        type: 'recurring_issue',
        title: `Increasing Trend: ${increasing.map((c) => c.name).join(', ')}`,
        summary: `The following complaint categories are showing an increasing trend: ${increasing.map((c) => `${c.name} (${c.count} complaints)`).join(', ')}.`,
        evidence: increasing.map((c) => ({ metric: 'complaintCount', value: c.count, label: c.name })),
        recommendation: 'Investigate the root cause of increasing complaints in these categories to prevent escalation.',
        confidence: 0.8,
        severity: 'warning',
        period: context.period,
      });
    }

    return insights;
  }

  /**
   * Simple text embedding for similarity calculation
   * Uses character n-grams for basic semantic similarity
   */
  private simpleTextEmbedding(text: string): number[] {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = normalized.split(/\s+/).filter((w) => w.length > 2);
    
    // Create a simple 100-dimensional vector based on word hashes
    const vector = new Array(100).fill(0);
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 31 + word.charCodeAt(i)) % 100;
      }
      vector[Math.abs(hash)] += 1;
    }
    
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      return vector.map((v) => v / norm);
    }
    return vector;
  }
}

// Export singleton instance
export const aiService = new AIService();
