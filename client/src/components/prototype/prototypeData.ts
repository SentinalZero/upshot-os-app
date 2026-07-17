export const prototypeData = {
  industries: {
    "Logistics": {
      label: "Logistics",
      tone: "dispatch, driver updates, delivery exceptions, documents, invoices",
      systems: ["Microsoft 365", "Gmail", "Slack", "QuickBooks", "Google Calendar", "ServiceNow", "HubSpot", "Salesforce"],
      approvalTemplates: ["Delay escalations", "Customer-facing delivery updates", "Invoice exceptions", "Driver compliance issues"]
    },
    "Customer Success": {
      label: "Customer Success",
      tone: "renewals, customer health, meeting follow-up, CRM hygiene, expansion signals",
      systems: ["Salesforce", "HubSpot", "Slack", "Microsoft 365", "Gmail", "Google Calendar", "ServiceNow", "QuickBooks"],
      approvalTemplates: ["Renewal risk escalations", "Executive customer emails", "Churn-risk status changes", "Pricing or contract mentions"]
    },
    "Service Business": {
      label: "Service Business",
      tone: "appointments, intake, reminders, customer notes, reviews, staff coordination",
      systems: ["Google Calendar", "Gmail", "Microsoft 365", "HubSpot", "Slack", "QuickBooks", "Salesforce", "ServiceNow"],
      approvalTemplates: ["Urgent customer requests", "Refund or billing issues", "Negative review responses", "Staff schedule conflicts"]
    },
    "IT / SaaS": {
      label: "IT / SaaS",
      tone: "tickets, SLAs, escalations, customer status, documentation, support summaries",
      systems: ["ServiceNow", "Slack", "Microsoft 365", "Gmail", "Salesforce", "HubSpot", "Google Calendar", "QuickBooks"],
      approvalTemplates: ["SLA breach alerts", "Customer-impacting incidents", "Escalation handoffs", "High-priority ticket changes"]
    }
  },
  scenarios: {
    "Logistics": {
      title: "Logistics operator drowning in dispatch updates",
      copy: "A Dispatch Coordinator clears routine updates, flags delivery delays, pauses customer-facing exceptions, and records capacity impact for the operations lead.",
      role: "Dispatch Coordinator",
      tasks: ["Send driver updates", "Track delivery status", "Escalate delivery delays", "Create daily dispatch summaries"],
      apps: ["Microsoft 365", "Gmail", "QuickBooks"],
      proof: "The buyer sees fewer manual dispatch touches, faster customer updates, and cleaner invoice handoffs without removing human approval from risky moments."
    },
    "Customer Success": {
      title: "CS team buried in follow-ups and CRM hygiene",
      copy: "A CS Operations Specialist turns meetings into clean follow-up, renewal tasks, health updates, and escalation paths while customer-sensitive messages stay gated.",
      role: "CS Operations Specialist",
      tasks: ["Summarize customer meetings", "Send follow-up emails", "Update CRM fields", "Track renewal risks"],
      apps: ["Salesforce", "Slack", "Google Calendar"],
      proof: "The buyer sees stronger account coverage, cleaner CRM data, and fewer missed renewal signals without adding another CS coordinator."
    },
    "Service Business": {
      title: "Service business losing time to intake and reminders",
      copy: "A Receptionist Admin routes inquiries, books appointments, sends reminders, and pauses for urgent customer or billing issues.",
      role: "Receptionist Admin",
      tasks: ["Route new inquiries", "Schedule appointments", "Send appointment reminders", "Escalate urgent requests"],
      apps: ["Google Calendar", "Gmail", "HubSpot"],
      proof: "The buyer sees fewer missed leads, cleaner scheduling, and faster responses while staff remains in control of sensitive customer moments."
    },
    "IT / SaaS": {
      title: "Support team needs cleaner SLA execution",
      copy: "An IT Support Coordinator classifies tickets, watches SLA risk, sends updates, routes escalations, and creates summaries for managers.",
      role: "IT Support Coordinator",
      tasks: ["Classify support tickets", "Track SLA risk", "Send status updates", "Route escalations"],
      apps: ["ServiceNow", "Slack", "Microsoft 365"],
      proof: "The buyer sees fewer stale tickets, better escalation hygiene, and stronger customer communication without forcing engineers to chase admin work."
    }
  },
  roles: [
    { name: "Dispatch Coordinator", bestFit: "Logistics", tasks: ["Send driver updates", "Track delivery status", "Escalate delivery delays", "Create daily dispatch summaries", "Log customer requests"], defaultApps: ["Microsoft 365", "Gmail", "QuickBooks"] },
    { name: "CS Operations Specialist", bestFit: "Customer Success", tasks: ["Summarize customer meetings", "Send follow-up emails", "Update CRM fields", "Track renewal risks", "Schedule customer check-ins"], defaultApps: ["Salesforce", "Slack", "Google Calendar"] },
    { name: "Receptionist Admin", bestFit: "Service Business", tasks: ["Route new inquiries", "Schedule appointments", "Send appointment reminders", "Log customer notes", "Escalate urgent requests"], defaultApps: ["Google Calendar", "Gmail", "HubSpot"] },
    { name: "IT Support Coordinator", bestFit: "IT / SaaS", tasks: ["Classify support tickets", "Track SLA risk", "Send status updates", "Route escalations", "Create support summaries"], defaultApps: ["ServiceNow", "Slack", "Microsoft 365"] }
  ]
} as const;

export type IndustryKey = keyof typeof prototypeData.industries;
export type Role = typeof prototypeData.roles[number];

export interface LiveEvent {
  type: "complete" | "approval";
  title: string;
  detail: string;
}
