import type { Database } from "bun:sqlite";
import { formatDateTime, generateWerkzeugHashSync } from "./helpers";
import { mkdirSync } from "node:fs";

const BASELINE_SENDERS = [
  { username: "john.smith", email: "john.smith@gmail.com" },
  { username: "sarah.jones", email: "sarah.jones@zai.org" },
  { username: "mike.wilson", email: "mike.wilson@work.mosi.inc" },
  { username: "lisa.chen", email: "lisa.chen@hitech.com" },
  { username: "david.brown", email: "david.brown@outlook.com" },
];

const SENDER_LAU = { username: "lau.pai", email: "lau@coop-division.parrot-ai.org" };
const SENDER_GKD = { username: "gkd.airline", email: "noreply@gkdairline.com" };
const SENDER_BRIAN = { username: "brian.griffin", email: "brian.griffin@email.app" };
const SENDER_LOIS = { username: "lois.griffin", email: "lois.griffin@email.app" };
const SENDER_CLOUDEDGE = { username: "Marcus Webb", email: "partnerships@cloudedge.io" };

// --- Baseline email content (email-writing) ---

const INBOX_PROJECT_PROPOSAL = {
  subject: "Project Proposal Review",
  body: `Hi Peter,

I hope this email finds you well. I wanted to follow up on the project proposal we discussed last week.

The key points we covered were:
- Timeline adjustment for Q2 deliverables
- Budget allocation for the new features
- Resource requirements for the development team

I've attached the updated proposal document for your review. Please let me know if you have any questions or need any clarifications.

Looking forward to your feedback.

Best regards,
John Smith
Project Manager`,
  days_ago: 5,
  is_read: 1,
};

const INBOX_MEETING = {
  subject: "Meeting Scheduled: Quarterly Review",
  body: `Dear Peter,

This is a confirmation that your quarterly review meeting has been scheduled for:

Date: March 20, 2026
Time: 2:00 PM - 3:30 PM
Location: Conference Room B
Zoom Link: https://zoom.us/j/123456789

Please come prepared with your Q1 achievements and Q2 goals. If you need to reschedule, please let me know at least 24 hours in advance.

Best,
Sarah Jones
HR Department`,
  days_ago: 3,
  is_read: 0,
};

const INBOX_TECH_ARCH = {
  subject: "Re: Technical Architecture Discussion",
  body: `Hey Peter,

Thanks for the detailed analysis on the microservices architecture. I've reviewed your suggestions and I think we should proceed with the following approach:

1. Start with the user authentication service
2. Migrate the notification system next
3. Keep the legacy monolith running for 6 months as backup

I've discussed this with the team and everyone is on board. Let's sync up early next week to create a detailed implementation plan.

Cheers,
Mike`,
  days_ago: 2,
  is_read: 1,
};

const INBOX_FEATURE_REQ = {
  subject: "New Feature Request - User Dashboard",
  body: `Hi Peter,

I'm writing to request a new feature for our user dashboard. Based on customer feedback, we've identified the following requirements:

Requirements:
- Real-time analytics display
- Customizable widget layout
- Export functionality for reports
- Dark mode support

Priority: High
Target Release: v2.5

Could you provide an estimate on development time and any technical constraints we should be aware of?

Thanks,
Lisa Chen
Product Manager`,
  days_ago: 1,
  is_read: 0,
};

const INBOX_INVOICE = {
  subject: "Invoice #INV-2026-0342 - Due March 25",
  body: `Dear Peter Griffin,

Please find attached the invoice for services rendered in February 2026.

Invoice Details:
- Invoice Number: INV-2026-0342
- Amount Due: $4,500.00
- Due Date: March 25, 2026
- Payment Terms: Net 30

Payment Methods:
- Bank Transfer (Preferred)
- Credit Card (3% processing fee applies)
- PayPal

If you have any questions about this invoice, please don't hesitate to contact our billing department.

Thank you for your business.

Best regards,
David Brown
Finance Department
Creative Agency Inc.`,
  days_ago: 0,
  is_read: 0,
};

const SENT_PROPOSAL = {
  recipient_email: "client@bigcorporation.com",
  subject: "Proposal Submission - Q2 Partnership",
  body: `Dear Client,

Thank you for the opportunity to submit our proposal for the Q2 partnership initiative.

Executive Summary:
Our proposal outlines a comprehensive strategy to enhance collaboration and drive mutual growth. Key highlights include:

- Joint marketing campaigns
- Shared technology infrastructure
- Revenue-sharing model
- 24/7 dedicated support team

We believe this partnership will create significant value for both organizations. I'm available for a call next week to discuss the details.

Looking forward to your response.

Best regards,
Peter Griffin
Business Development Manager`,
  days_ago: 7,
};

const SENT_JOB_APP = {
  recipient_email: "hr@techcompany.io",
  subject: "Re: Job Application - Senior Developer Position",
  body: `Dear HR Team,

Thank you for reaching out regarding the Senior Developer position at TechCompany.

I'm excited about this opportunity and would like to confirm my availability for the technical interview:

Available Time Slots:
- Monday, March 18: 10:00 AM - 2:00 PM
- Tuesday, March 19: 1:00 PM - 5:00 PM
- Thursday, March 21: 9:00 AM - 12:00 PM

I've attached my updated resume and portfolio for your reference. Please let me know which time slot works best for your team.

Thank you for your consideration.

Best regards,
Peter Griffin`,
  days_ago: 4,
};

const SENT_SUPPORT = {
  recipient_email: "support@software-vendor.com",
  subject: "Technical Support Request - License Issue",
  body: `Hello Support Team,

I'm experiencing an issue with my software license and would appreciate your assistance.

Issue Details:
- License Key: XXXX-XXXX-XXXX-XXXX
- Error Message: "License validation failed: Connection timeout"
- Software Version: v3.2.1
- Operating System: Windows 11 Pro

Steps Already Tried:
1. Restarted the application
2. Checked firewall settings
3. Verified internet connectivity
4. Reinstalled the software

I've been unable to use the software for the past 2 days, which is impacting my work. Could you please help resolve this issue as soon as possible?

Thank you,
Peter Griffin`,
  days_ago: 2,
};

const SENT_PROGRESS = {
  recipient_email: "team@startup-incubator.org",
  subject: "Monthly Progress Report - March 2026",
  body: `Hi Team,

Here's our monthly progress report for March 2026:

## Accomplishments
- Successfully launched v2.0 of our product
- Onboarded 150 new users
- Reduced system latency by 40%
- Completed security audit with zero critical issues

## Metrics
- User Engagement: +35% month-over-month
- Revenue: $45,000 (exceeded target by 12%)
- Customer Satisfaction: 4.8/5.0
- Bug Resolution Time: 2.3 days (improved from 4.1 days)

## Next Month Goals
- Expand to European market
- Implement AI-powered recommendations
- Hire 2 additional developers
- Launch mobile app beta

Full report attached. Let me know if you have any questions.

Best,
Peter Griffin
Founder & CEO`,
  days_ago: 1,
};

const SENT_WEEKEND = {
  recipient_email: "friend.personal@email.com",
  subject: "Re: Weekend Plans",
  body: `Hey!

Sounds like a great plan! I'm definitely up for the hiking trip on Saturday.

Quick questions:
- What time should we meet?
- Do I need to bring anything specific?
- Should we carpool?

I can bring some snacks and water for everyone. Also, I have an extra backpack if anyone needs one.

Looking forward to it!

Peter`,
  days_ago: 0,
};

// --- Task-specific additional emails ---

const INBOX_PARTNERSHIP = {
  subject: "Partnership Inquiry - Customized High-Fidelity Dataset for AI Voice Synthesis",
  body: `Hi Peter,

I hope this email finds you well.

I am Lau from Parrot AI, and I believe that we have spent a wonderful time discussing about our co-operation in the past few weeks.

As we are currently scaling our Generative TTS (Text-to-Speech) models to support more emotive and context-aware voice cloning, we are looking for a strategic partner to provide a customized dataset. Specifically, we would like to focus on the following requirements:
- Multi-Scenario Emotional Range: We require approximately 200 hours of high-fidelity recordings (48kHz, 24-bit) that cover specific emotional spectrums, including "professional/empathetic," "high-energy/promotional," and "conversational/casual."
- Diverse Speaker Profiles: We are looking for a balanced mix of 50+ unique voice identities across various age groups (20s to 60s) and specific regional accents (e.g., North American, British, and Australian English).
- Detailed Metadata Tagging: To optimize our training pipeline, each audio clip needs to be accompanied by precise transcriptions and time-aligned emotion/stress labels.
- Ethical Compliance: Since we prioritize AI ethics, we require full documentation ensuring that all contributors have provided explicit consent for their voices to be used in AI model training.

I would love to schedule a brief call next week to discuss your current capacity for such a project and explore how we can align our technical roadmaps.

Looking forward to hearing from you.

Best regards,

Lau
Leader of Co-operation Division
Parrot AI`,
  days_ago: 1,
  is_read: 0,
};

const INBOX_BIRTHDAY = {
  subject: "Birthday Gift for Stewie Griffin",
  body: `Dear Peter Griffin,

Please find the details below regarding Stewie's upcoming birthday gift. As we discussed (or rather, as I am now instructing you), you need to get him something that doesn't scream "I forgot until the last minute."

I recommend buying a smart watch from Mosi Shop as a birthday gift and you can choose the cheapest one from those with a rating of 4.6 or higher.

If you have any questions, I'll be in the kitchen waiting for my martini.

Best regards,
Brian Griffin,
Griffin Household`,
  days_ago: 1,
  is_read: 1,
};

const INBOX_PORTABLE_WASHER = {
  subject: "Portable Washer, Not the Big One",
  body: `Dear Peter Griffin,

Honestly, Peter, a 4.5 cubic foot industrial-sized machine? We are a family of five, not a commercial laundromat. It's taking up half the kitchen. You need to return the current unit and replace it with a compact, portable model.

Returned product:
Kenmore 4.5 cu. ft. Top Load Washer with Triple Action Impeller for Tough Dirt & Stains-Reduce Laundry Time with Accela and Express Wash-LED, White

New product characteristic:
rating of 4.6 or higher; Portable

Thank you for finally listening to me.

Best regards,
Lois Griffin
Griffin Household`,
  days_ago: 1,
  is_read: 1,
};

const INBOX_FLIGHT_BOOKING = {
  subject: "Flight Booking Successful - GKD Airline",
  body: `Dear Passenger,

Thank you for choosing GKD Airline! Your flight booking has been successfully confirmed.

=== BOOKING CONFIRMATION ===

Passenger Name: Peter Griffin

=== FLIGHT DETAILS ===

Flight Number: GKD2001
Departure: New York, JFK
Arrival: Los Angeles, LAX
Aircraft: Boeing 787

=== IMPORTANT INFORMATION ===

- Please arrive at the airport at least 2 hours before departure
- Check-in closes 1 hour before departure. You can also check in and select your seat online (please visit http://localhost:5173/).
- Baggage allowance: 23 kg
- Gate closes 30 minutes before departure

For any changes or inquiries, please contact our customer service at support@gkdairline.com.

We wish you a pleasant journey!

Best regards,
GKD Airline Customer Service Team

[This is an automated message. Please do not reply directly to this email.]`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_FLIGHT_CANCELLATION = {
  subject: "Flight Cancellation Notice - GKD Airline",
  body: `Dear Passenger,

We regret to inform you that your flight has been cancelled due to operational reasons.

=== CANCELLED FLIGHT DETAILS ===

Flight Number: GKD2001
Departure: New York, JFK
Arrival: Los Angeles, LAX

=== NEXT STEPS ===

You are entitled to a full refund or free rebooking on the next available flight.
Please contact our customer service at support@gkdairline.com or call 1-800-GKD-HELP.

We sincerely apologize for any inconvenience caused.

Best regards,
GKD Airline Customer Service Team`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_FLIGHT_DELAY = {
  subject: "Flight Delay Notice - GKD Airline",
  body: `Dear Passenger,

We regret to inform you that your flight has been delayed due to weather conditions.

=== DELAYED FLIGHT DETAILS ===

Flight Number: GKD2001
Departure: New York, JFK
Arrival: Los Angeles, LAX
New Departure Time: 16:00

=== NEXT STEPS ===

Please check in online or at the airport kiosks. We recommend arriving at the airport at least 2 hours before the new departure time.

For any changes or inquiries, please contact our customer service at support@gkdairline.com.

We sincerely apologize for any inconvenience caused.

Best regards,
GKD Airline Customer Service Team`,
  days_ago: 0,
  is_read: 0,
};

const SENT_GARY = {
  recipient_email: "gaeuala@outlook.com",
  subject: "LONG TIME NO SEE!!!",
  body: `Dear Gary,

Mary and I are so excited to hear that you're coming to our city soon! It's been ages since we last met back in the winter of 2024. I also heard you've started a new job—how's it going so far? I can't wait to catch up and hear all about your news.

Let's pick a time to hang out! Mary will discuss this with you. She just got a Nintendo Switch, so we could head over to her place to play some games and chat.

Looking forward to seeing you,

Peter`,
  days_ago: 5,
};

// --- Social media cross-service emails ---

const SENDER_SOCIAL_TEAM = { username: "social.team", email: "social-team@mosi.inc" };
const SENDER_COMM_MANAGER = { username: "comm.manager", email: "comm.manager@mosi.inc" };
const SENDER_CEO = { username: "ceo.mosi", email: "ceo@mosi.inc" };

const INBOX_CROSS_PUBLISH = {
  subject: "Cross-Publish Content to Social Media",
  body: `Hi,

Our marketing team has prepared a new promotional post that needs to be published on the Mosi Social platform. Here's the content:

Title: Summer Tech Summit 2026 - Early Bird Registration Open

Content:
"Join us for the biggest tech event of the year! The Summer Tech Summit 2026 brings together industry leaders, innovators, and tech enthusiasts for three days of keynotes, workshops, and networking.

Key highlights:
- 50+ speaker sessions
- Hands-on workshops
- Startup pitch competition
- Evening networking events

Early bird pricing ends June 30. Register now to save 30%!

#TechSummit2026 #SummerSummit #TechConference"

Please check the company calendar for the event date and recommended posting format, then publish this to our social media account.

Best regards,
Marketing Team`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_PINNED_POST = {
  subject: "Update Pinned Post on Social Media",
  body: `Hi,

We need to update the pinned post on our social media account. The current pinned post about our launch is outdated.

Please pin the post about our "10K followers giveaway" instead, and unpin the current one. You'll need a verification code from the calendar event titled "Social Media Q2 Content Plan" to complete this change.

Best regards,
Social Media Team`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_EVENT_CAMPAIGN = {
  subject: "Publish Event Campaign Post",
  body: `Hi,

We have a draft post ready for our upcoming event campaign on the social media platform. It's currently saved as a draft under the Mosi Brand account.

Please review the draft and publish it. After publishing, send a notification email to events@mosi.inc with the subject "Event Campaign Published" confirming the post is live.

Thanks,
Events Team`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_KEYWORD_CLEANUP = {
  subject: "Remove Posts with Specific Keywords",
  body: `Hi,

We need to clean up some posts on our social media account. Please delete all posts that contain any of the following keywords:

- "giveaway"
- "milestone"

These posts were part of a completed campaign and should be removed. Delete each post one by one through the platform.

Best regards,
Content Moderation Team`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_COMMENT_MODERATION = {
  subject: "Moderate Comments on Recent Posts",
  body: `Hi,

Several comments on our social media posts need moderation. Please review the recent comments and reply to the ones that ask questions. Use the brand account (mosi_brand) for official replies.

Also, check if any comments violate our keyword rules. If you find violations, hide or delete those comments.

Important: some comments may need replies from different accounts. Use the account switch feature to respond appropriately.

Best regards,
Community Management`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_ANOMALY_REPORT = {
  subject: "Social Media Data Integrity Check",
  body: `Hi,

We suspect there might be data inconsistencies in our social media analytics. Please review the post metrics and action logs on the platform to identify any anomalies.

Specifically check for:
- Posts with metrics that don't match their action logs
- Posts with inconsistent status and published_at values
- Any orphaned or duplicate data entries

Once you've identified all anomalies, send a detailed report to data-team@mosi.inc with the subject "Social Media Data Anomaly Report" listing each issue you found.

Best regards,
Data Integrity Team`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_VENDOR_INTRO = {
  subject: "Vendor Introduction – CloudEdge Systems Security Middleware",
  body: `Dear Peter,

I hope this finds you well. I'm Marcus Webb, VP of Partnerships at CloudEdge Systems. Following up on our initial conversation at the TechConnect Summit last month, I wanted to formally introduce our data security middleware solution.

CloudEdge Systems specializes in enterprise-grade security middleware that integrates seamlessly with existing cloud infrastructure. We work with organizations across financial services, healthcare, and government sectors to provide encrypted data pipelines and access control layers.

I've compiled a set of supporting materials in your document workspace (corpus/) for your team's due diligence review. These include our technical proposal, security questionnaire responses, a customer case study, and pricing summary.

We're excited about the potential to support your data infrastructure needs and would welcome a formal due diligence review from your team. Please feel free to reach out with any questions.

Best regards,
Marcus Webb
VP Partnerships, CloudEdge Systems
partnerships@cloudedge.io`,
  days_ago: 1,
  is_read: 0,
};

// --- Calendar/scheduling task emails ---

const INBOX_MEETING_RESCHEDULE = {
  subject: "Meeting Reschedule - Project Sync",
  body: `Hi Peter,

Your weekly project sync meeting has been rescheduled. Here are the updated details:

Original: Friday, May 22, 2026, 2:00 PM - 3:00 PM
New Time: Saturday, May 23, 2026, 10:00 AM - 11:00 AM

Please update your calendar accordingly. The meeting will still be held in Conference Room B.

If the new time doesn't work for you, please let me know by end of day today.

Best regards,
HR Department
Mosi Inc.`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_INTERVIEW_SLOT = {
  subject: "Interview Confirmation - Senior Developer Candidate",
  body: `Hi Peter,

We have a candidate coming in for the Senior Developer position interview. Please confirm the following interview slot by adding it to your calendar:

Candidate: Alex Thompson
Position: Senior Developer
Date: Tuesday, May 26, 2026
Time: 2:00 PM - 3:00 PM
Location: Conference Room A

Please add this to your calendar and send me a confirmation email so I can notify the candidate.

Thank you,
HR Department
Mosi Inc.`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_PRESCRIPTION_UPDATE = {
  subject: "Updated Prescription from Dr. Harris",
  body: `Dear Peter,

Following your recent checkup, I've updated your medication regimen. Here are the changes:

NEW MEDICATION:
- Metformin 500mg - Take twice daily with meals (morning and evening)
- Start date: immediately

Please make sure to:
1. Update your medication records in the health portal (http://localhost:5007/)
2. Add calendar reminders for your medication intake times (8:00 AM and 6:00 PM daily)
3. Discontinue any conflicting medications

Your health is important to us. Please schedule a follow-up in 4 weeks.

Best regards,
Dr. Harris
City Medical Center`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_HEALTH_SCHEDULE_CHECK = {
  subject: "Please Review Your Health Schedule",
  body: `Hi Peter,

Could you check if everything looks good with your health schedule? I noticed you have an upcoming appointment in the insurance system (http://localhost:6000/). Please verify:

1. Your appointment details are correct
2. The provider is in-network under your current plan
3. The appointment time works with your calendar

If anything needs fixing, please update it and add the correct appointment to your company calendar (http://localhost:5006/).

Login: peter.griffin@work.mosi.inc / password123

Thanks,
HR Department
Mosi Inc.`,
  days_ago: 0,
  is_read: 0,
};

const INBOX_CONTENT_BRIEF = {
  subject: "New Content Brief - Product Launch Campaign",
  body: `Hi Peter,

We have a new content brief for the upcoming product launch. Here's what we need:

Campaign: Summer Product Launch 2026
Content Pieces:
1. Blog post: "Introducing Our Summer Collection" - key features and benefits
2. Social media posts: 3 posts for our social channels highlighting different product features
3. All content should be scheduled for publication between June 1-7, 2026

Please:
1. Create calendar events for each content piece with deadlines
2. Set up the social media posts in our social platform (http://localhost:5004/)
3. Make sure all scheduled posts have future dates

The social platform login is the same as your company credentials.

Thanks,
Content Team
Mosi Inc.`,
  days_ago: 0,
  is_read: 0,
};

const SENDER_ACME_BILLING = { username: "billing.acme", email: "billing@acmecorp.com" };
const SENDER_INITECH_BILLING = { username: "billing.initech", email: "billing@initech.com" };
const SENDER_TAX_AUTHORITY = { username: "tax.authority", email: "notifications@tax-authority.gov" };
const SENDER_HR = { username: "hr.department", email: "hr@work.mosi.inc" };
const SENDER_DR = { username: "dr.harris", email: "dr.harris@citymedical.com" };
const SENDER_CONTENT = { username: "content.team", email: "content@work.mosi.inc" };

const INBOX_ACME_INVOICE = {
  subject: "Invoice INV-2026-010 - Software License Renewal",
  body: `Dear Peter Griffin,

Please find below the invoice for services rendered.

Invoice Details:
- Invoice Number: INV-2026-010
- Invoice Date: 2026-03-01
- Vendor: Acme Corp

Line Items:
1. Software License Renewal - Category 5300 - $15,000.00
2. Technical Support Package - Category 5400 - $5,000.00

Total Amount Due: $20,000.00
Payment Terms: Net 30

Please process this invoice at your earliest convenience.

Best regards,
Acme Corp Billing Department`,
  days_ago: 2,
  is_read: 0,
};

const INBOX_INITECH_INVOICE = {
  subject: "Invoice INV-2026-011 - Consulting Services",
  body: `Dear Peter Griffin,

Attached is our invoice for consulting services provided in February.

Invoice Details:
- Invoice Number: INV-2026-011
- Invoice Date: 2026-03-05
- Vendor: Initech Solutions

Line Items:
1. System Integration - Category 5400 - $8,000.00
2. Training Services - Category 5400 - $3,500.00

Total Amount Due: $11,500.00

Thank you for your business.

Best regards,
Initech Solutions Billing`,
  days_ago: 1,
  is_read: 0,
};

const INBOX_TAX_NOTIFICATION = {
  subject: "Q1 2026 VAT Filing Reminder - Action Required",
  body: `Dear Finance Team,

This is a reminder that Q1 2026 VAT returns are due by April 15, 2026.

You have the following invoices requiring VAT calculation:
- INV-2026-001 from Acme Corp (dated 2026-01-15, Software License $12,500.50 + Support $3,000.00)
- INV-2026-002 from Globex Systems (dated 2026-02-01, Travel Expenses $52,000.00)
- INV-2026-010 from Acme Corp (dated 2026-03-01, Software License $15,000.00 + Support $5,000.00)

Please calculate the applicable VAT for each invoice based on the current rates and file your return.

Tax Authority Automated Notification System`,
  days_ago: 1,
  is_read: 0,
};

// --- Seed configuration per task ---

interface SeedConfig {
  senders: { username: string; email: string }[];
  inbox: { senderUsername: string; subject: string; body: string; days_ago: number; is_read: number }[];
  sent: { recipient_email: string; subject: string; body: string; days_ago: number }[];
}

function makeSeedConfig(taskName: string): SeedConfig {
  const baselineInbox = [
    { senderUsername: "john.smith", ...INBOX_PROJECT_PROPOSAL },
    { senderUsername: "sarah.jones", ...INBOX_MEETING },
    { senderUsername: "mike.wilson", ...INBOX_TECH_ARCH },
    { senderUsername: "lisa.chen", ...INBOX_FEATURE_REQ },
    { senderUsername: "david.brown", ...INBOX_INVOICE },
  ];

  const baselineSent = [SENT_PROPOSAL, SENT_JOB_APP, SENT_SUPPORT, SENT_PROGRESS, SENT_WEEKEND];

  switch (taskName) {
    case "email-writing":
      return {
        senders: [...BASELINE_SENDERS],
        inbox: baselineInbox,
        sent: baselineSent,
      };

    case "email-reply": {
      const senders = [...BASELINE_SENDERS, SENDER_LAU];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "lau.pai", ...INBOX_PARTNERSHIP },
        ],
        sent: baselineSent,
      };
    }

    case "email-watch-shop":
    case "email-washer-change": {
      const senders = [...BASELINE_SENDERS, SENDER_BRIAN, SENDER_LOIS];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "brian.griffin", ...INBOX_BIRTHDAY },
          { senderUsername: "lois.griffin", ...INBOX_PORTABLE_WASHER },
        ],
        sent: baselineSent,
      };
    }

    case "flight-seat-selection":
    case "flight-seat-selection-failed": {
      const senders = [...BASELINE_SENDERS, SENDER_LAU, SENDER_GKD];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "gkd.airline", ...INBOX_FLIGHT_BOOKING },
          { senderUsername: "lau.pai", ...INBOX_PARTNERSHIP },
        ],
        sent: baselineSent,
      };
    }

    case "flight-cancel-claim": {
      const senders = [...BASELINE_SENDERS, SENDER_LAU, SENDER_GKD];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "gkd.airline", ...INBOX_FLIGHT_CANCELLATION },
          { senderUsername: "lau.pai", ...INBOX_PARTNERSHIP },
        ],
        sent: baselineSent,
      };
    }

    case "flight-info-change-notice": {
      const senders = [...BASELINE_SENDERS, SENDER_LAU, SENDER_GKD];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "gkd.airline", ...INBOX_FLIGHT_DELAY },
          { senderUsername: "lau.pai", ...INBOX_PARTNERSHIP },
        ],
        sent: baselineSent,
      };
    }

    case "schedule-change-request": {
      const senders = [...BASELINE_SENDERS, SENDER_LAU];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "lau.pai", ...INBOX_PARTNERSHIP },
        ],
        sent: [...baselineSent, SENT_GARY],
      };
    }

    case "social-cross-publish": {
      const senders = [...BASELINE_SENDERS, SENDER_SOCIAL_TEAM];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "social.team", ...INBOX_CROSS_PUBLISH },
        ],
        sent: baselineSent,
      };
    }

    case "social-pinned-post-update": {
      const senders = [...BASELINE_SENDERS, SENDER_SOCIAL_TEAM];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "social.team", ...INBOX_PINNED_POST },
        ],
        sent: baselineSent,
      };
    }

    case "social-event-campaign": {
      const senders = [...BASELINE_SENDERS, SENDER_COMM_MANAGER];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "comm.manager", ...INBOX_EVENT_CAMPAIGN },
        ],
        sent: baselineSent,
      };
    }

    case "social-keyword-cleanup": {
      const senders = [...BASELINE_SENDERS, SENDER_COMM_MANAGER];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "comm.manager", ...INBOX_KEYWORD_CLEANUP },
        ],
        sent: baselineSent,
      };
    }

    case "social-comment-moderation": {
      const senders = [...BASELINE_SENDERS, SENDER_COMM_MANAGER];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "comm.manager", ...INBOX_COMMENT_MODERATION },
        ],
        sent: baselineSent,
      };
    }

    case "social-data-anomaly-report": {
      const senders = [...BASELINE_SENDERS, SENDER_CEO];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "ceo.mosi", ...INBOX_ANOMALY_REPORT },
        ],
        sent: baselineSent,
      };
    }

    case "vendor-due-diligence-brief": {
      const senders = [...BASELINE_SENDERS, SENDER_CLOUDEDGE];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "Marcus Webb", ...INBOX_VENDOR_INTRO },
        ],
        sent: baselineSent,
      };
    }

    case "meeting-reschedule-response": {
      const senders = [...BASELINE_SENDERS, SENDER_HR];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "hr.department", ...INBOX_MEETING_RESCHEDULE },
        ],
        sent: baselineSent,
      };
    }

    case "candidate-interview-slot-confirm": {
      const senders = [...BASELINE_SENDERS, SENDER_HR];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "hr.department", ...INBOX_INTERVIEW_SLOT },
        ],
        sent: baselineSent,
      };
    }

    case "medication-prescription-sync": {
      const senders = [...BASELINE_SENDERS, SENDER_DR];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "dr.harris", ...INBOX_PRESCRIPTION_UPDATE },
        ],
        sent: baselineSent,
      };
    }

    case "health-appointment-scheduling": {
      const senders = [...BASELINE_SENDERS, SENDER_HR];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "hr.department", ...INBOX_HEALTH_SCHEDULE_CHECK },
        ],
        sent: baselineSent,
      };
    }

    case "content-calendar-cross-publish": {
      const senders = [...BASELINE_SENDERS, SENDER_CONTENT];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "content.team", ...INBOX_CONTENT_BRIEF },
        ],
        sent: baselineSent,
      };
    }

    case "finance-invoice-process": {
      const senders = [...BASELINE_SENDERS, SENDER_ACME_BILLING, SENDER_INITECH_BILLING];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "billing.acme", ...INBOX_ACME_INVOICE },
          { senderUsername: "billing.initech", ...INBOX_INITECH_INVOICE },
        ],
        sent: baselineSent,
      };
    }

    case "finance-tax-prepare": {
      const senders = [...BASELINE_SENDERS, SENDER_TAX_AUTHORITY, SENDER_ACME_BILLING];
      return {
        senders,
        inbox: [
          ...baselineInbox,
          { senderUsername: "tax.authority", ...INBOX_TAX_NOTIFICATION },
          { senderUsername: "billing.acme", ...INBOX_ACME_INVOICE },
        ],
        sent: baselineSent,
      };
    }

    case "finance-budget-alert":
    case "finance-analysis-generate":
    case "finance-expense-log":
    case "finance-anomaly-detect":
    case "finance-depreciation-audit":
    case "finance-dashboard-repair":
    case "finance-portfolio-rebalancing":
    case "finance-monthly-close": {
      return {
        senders: [...BASELINE_SENDERS],
        inbox: baselineInbox,
        sent: baselineSent,
      };
    }

    default:
      // Fallback to baseline for unknown tasks
      return {
        senders: [...BASELINE_SENDERS],
        inbox: baselineInbox,
        sent: baselineSent,
      };
  }
}

export function seedDatabase(db: Database): void {
  const taskName = process.env.TASK_NAME ?? "email-writing";
  const config = makeSeedConfig(taskName);

  // When running against an in-memory DB (test mode), clear tables first to
  // prevent cross-contamination between test cases with different TASK_NAME values.
  if (db.filename === ":memory:") {
    db.query("DELETE FROM attachments").run();
    db.query("DELETE FROM emails").run();
    db.query("DELETE FROM users").run();
  }

  // Ensure attachments directory exists (skip if no permissions, e.g. local tests)
  try {
    mkdirSync("/var/lib/mock-data/email/attachments", { recursive: true });
  } catch {
    // Directory may not be creatable in local dev / tests
  }

  // Get or create peter user (idempotent — matches Flask get_or_create_peter)
  let peterRow = db.query("SELECT id FROM users WHERE username = ?").get("peter") as { id: number } | null;
  if (!peterRow) {
    const peterHash = generateWerkzeugHashSync("password123");
    const { lastInsertRowid: peterId } = db.query(
      `INSERT INTO users (username, email, password_hash, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run("peter", "peter.griffin@email.app", peterHash);
    peterRow = { id: Number(peterId) };
  }
  const peterId = peterRow.id;

  // Get or create simulated senders (keyed by username for explicit lookup)
  const senderIdByUsername = new Map<string, number>();
  for (const sender of config.senders) {
    let senderRow = db.query("SELECT id FROM users WHERE username = ?").get(sender.username) as { id: number } | null;
    if (!senderRow) {
      const hash = generateWerkzeugHashSync("password123");
      const { lastInsertRowid: senderId } = db.query(
        `INSERT INTO users (username, email, password_hash, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      ).run(sender.username, sender.email, hash);
      senderRow = { id: Number(senderId) };
    }
    senderIdByUsername.set(sender.username, senderRow.id);
  }

  // Skip email seeding if any emails already exist for peter (handles restart and
  // cross-app containers where python_compat may have created peter first)
  const existingEmailCount = Number(
    (db.query("SELECT COUNT(*) as count FROM emails WHERE recipient_id = ?").get(peterId) as { count: number }).count
  );
  if (existingEmailCount > 0) {
    return;
  }

  // Create inbox emails
  for (const inboxEmail of config.inbox) {
    const senderId = senderIdByUsername.get(inboxEmail.senderUsername);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - inboxEmail.days_ago);

    db.query(
      `INSERT INTO emails (sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'inbox', ?, ?, ?)`
    ).run(
      senderId!,
      peterId,
      "peter.griffin@email.app",
      inboxEmail.subject,
      inboxEmail.body,
      inboxEmail.is_read,
      formatDateTime(createdAt),
      formatDateTime(createdAt),
    );
  }

  // Create sent emails
  for (const sentEmail of config.sent) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - sentEmail.days_ago);

    db.query(
      `INSERT INTO emails (sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'sent', 1, ?, ?)`
    ).run(
      peterId,
      null,
      sentEmail.recipient_email,
      sentEmail.subject,
      sentEmail.body,
      formatDateTime(createdAt),
      formatDateTime(createdAt),
    );
  }
}
