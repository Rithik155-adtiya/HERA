# HERA — Hostel Emergency & Resolution Assistant

> **AI-Powered Smart Hostel Complaint & Resolution Management Platform**

HERA (Hostel Emergency & Resolution Assistant) is a full-stack hostel complaint management platform designed to make hostel issue reporting, classification, assignment, tracking, escalation, and resolution faster and more organized.

The platform combines a modern web interface, MongoDB-based data storage, REST APIs, real-time updates, analytics, and optional Google Gemini AI assistance to intelligently process hostel complaints.

---

## 🚀 Project Overview

Traditional hostel complaints are often handled through paper registers, verbal communication, WhatsApp messages, or informal reporting methods. This can result in:

- Complaints being missed
- Delayed responses
- Complaints reaching the wrong department
- No clear priority
- Duplicate complaints
- Poor complaint tracking
- Lack of transparency
- Difficulty identifying recurring hostel problems

HERA provides a centralized digital platform where hostel complaints can be submitted and managed through a structured workflow.

### Core Workflow

```text
Student submits complaint
        ↓
Complaint stored in MongoDB
        ↓
AI analyzes complaint (when Gemini is configured)
        ↓
Category & priority are identified
        ↓
Possible duplicate issues are checked
        ↓
Complaint is reviewed/assigned
        ↓
Staff handles the complaint
        ↓
Complaint status is updated
        ↓
Escalation occurs when required
        ↓
Student receives updates
        ↓
Complaint is resolved
        ↓
Student confirms resolution
        ↓
Feedback & analytics are updated
