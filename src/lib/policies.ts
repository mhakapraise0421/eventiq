export interface PolicySection {
  heading: string;
  body: string[];
}

export interface Policy {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  updated: string;
  sections: PolicySection[];
}

const UPDATED = "1 March 2026";

export const POLICIES: Policy[] = [
  {
    slug: "terms",
    title: "Terms & Conditions",
    eyebrow: "Platform terms",
    summary:
      "The rules that apply when you browse EventIQ, buy a ticket, publish an event or scan guests at a gate.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. About these terms",
        body: [
          "EventIQ is a Zimbabwe-first event discovery, ticketing and gate operations platform. By creating an account, purchasing a ticket, publishing an event or using the scanner you agree to these terms.",
          "Where an event listing states its own entry conditions, those conditions apply alongside these terms. The organizer is responsible for the accuracy of the listing and for delivering the event as described.",
        ],
      },
      {
        heading: "2. Accounts",
        body: [
          "You must provide accurate name, email and phone details and keep them up to date. One person may hold one attendee account unless we approve a shared organizer account.",
          "You are responsible for keeping your password confidential. Notify support immediately if you suspect unauthorized access. We may suspend an account that is used for fraud, abusive behaviour or repeated policy breaches.",
        ],
      },
      {
        heading: "3. Ticket purchases",
        body: [
          "A ticket order is a reservation for a limited period. Inventory is only confirmed once payment is completed; unpaid orders expire and release their tickets automatically.",
          "Prices are shown in United States dollars (USD) unless the listing says otherwise. The order summary displays the ticket price, the EventIQ service fee and the total before payment.",
          "Tickets are personal unless the organizer marks them as transferable. You must present a valid QR code at the gate. Screenshots of used or duplicated codes will be rejected.",
        ],
      },
      {
        heading: "4. Simulated payments",
        body: [
          "This deployment runs in demonstration mode. Card, mobile money and cash-on-gate options are simulated; no real money is collected and no card numbers are stored.",
          "Do not enter real payment credentials. In a live deployment, payments would be processed by licensed payment partners and settled to organizers after the event.",
        ],
      },
      {
        heading: "5. Entry and conduct",
        body: [
          "Entry is subject to the venue's rules, age restrictions and security checks. A valid ticket does not guarantee entry if you are intoxicated, abusive or carrying prohibited items.",
          "Each QR code is single-use. Our gate scanner records the time, gate and operator of every accepted scan so that duplicate entry attempts can be investigated.",
        ],
      },
      {
        heading: "6. Organizer obligations",
        body: [
          "Organizers must hold the rights and permits needed for their event, describe it honestly, maintain adequate capacity and honor every valid ticket sold through EventIQ.",
          "Organizers may not cancel an approved event without notifying EventIQ. Where an event is cancelled or materially changed, refund handling follows our Refunds & Cancellations policy.",
        ],
      },
      {
        heading: "7. Liability",
        body: [
          "EventIQ provides discovery and ticketing technology. The organizer is responsible for the event itself, including health and safety, licensing and the experience delivered.",
          "To the extent permitted by Zimbabwean law, EventIQ is not liable for indirect losses arising from an event cancellation or from a guest being refused entry under venue rules.",
        ],
      },
      {
        heading: "8. Changes and governing law",
        body: [
          "We may update these terms as the platform evolves. Material changes will be announced in-product before they take effect.",
          "These terms are governed by the laws of Zimbabwe. Disputes are handled under the process described in our Dispute Resolution policy.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "Your data",
    summary:
      "What we collect, why we collect it and the controls you have over your personal information.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Information we collect",
        body: [
          "Account details: name, email address, phone number, city and password hash. Passwords are stored using scrypt hashing and are never written to logs.",
          "Order and ticket details: the events you book, ticket tiers, amounts, payment state, ticket codes and scan history.",
          "Operational data: gate assignment, scan timestamps, device identifiers and audit records of administrative actions.",
        ],
      },
      {
        heading: "2. How we use it",
        body: [
          "To create and secure your account, issue and validate tickets, prevent duplicate entry and support refunds or disputes.",
          "To send transactional messages such as order confirmations and event updates. Marketing messages are only sent where you have opted in, and you can change those preferences from your profile.",
          "To produce aggregate reporting for organizers and administrators. Reports use counts and totals, not attendee contact details.",
        ],
      },
      {
        heading: "3. Sharing",
        body: [
          "Organizers receive the attendee name and ticket tier associated with a ticket so they can manage entry and guest lists. They do not receive your password or full payment history.",
          "We share data with service providers only where needed to operate the platform, and with authorities where required by Zimbabwean law.",
          "We do not sell personal information.",
        ],
      },
      {
        heading: "4. Retention",
        body: [
          "Order, ticket and scan records are retained for the period needed for reconciliation, dispute resolution and legal obligations. Audit records are append-only.",
          "You may request closure of your account. Where closure would remove records needed for an active dispute or legal duty, we will explain what must be retained.",
        ],
      },
      {
        heading: "5. Your choices",
        body: [
          "You can update your name, phone, city and notification preferences from your profile. You can change your password at any time.",
          "To request access, correction or deletion of your data, contact support@eventiq.co.zw. We aim to respond within a reasonable period and will verify your identity first.",
        ],
      },
      {
        heading: "6. Security",
        body: [
          "Sessions are signed, HTTP-only cookies with a seven-day lifetime. Administrative and refund actions are written to an audit log with the actor, action and timestamp.",
          "Ticket QR payloads are cryptographically signed and validated on the server, so a forged code cannot be admitted by editing the QR image.",
        ],
      },
    ],
  },
  {
    slug: "refunds",
    title: "Refunds & Cancellations",
    eyebrow: "Money back",
    summary:
      "When a refund is available, how organizer cancellations are handled and what happens to your tickets.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Before you pay",
        body: [
          "Review the event date, venue, ticket tier and entry conditions before completing payment. Unpaid orders expire automatically and release their inventory.",
          "Service fees cover the cost of processing and are shown separately in the order summary.",
        ],
      },
      {
        heading: "2. Standard refunds",
        body: [
          "Refund eligibility is set by the organizer and shown on the event listing. Unless the listing states otherwise, tickets are non-refundable once payment is complete.",
          "Where a refund is approved, it is processed against the original order. All unused tickets on that order are voided and can no longer be scanned for entry.",
          "Tickets that have already been scanned cannot be refunded through self-service. Contact customer service with the order reference so the case can be reviewed.",
        ],
      },
      {
        heading: "3. Event cancelled or rescheduled",
        body: [
          "If an organizer cancels an event, paid orders are eligible for a full refund of the ticket price. Service fees are refunded where the cancellation is not caused by the attendee.",
          "If an event is rescheduled, existing tickets remain valid for the new date unless the organizer announces otherwise. Attendees who cannot attend the new date may request a refund within the window stated in the announcement.",
        ],
      },
      {
        heading: "4. How refunds are issued",
        body: [
          "Refunds are initiated by an administrator or the organizer through the EventIQ console and recorded in the audit log.",
          "In this demonstration environment, refunds update the order and ticket records immediately but do not move real funds. In production, the refund returns to the original payment method within the provider's stated timeframe.",
        ],
      },
      {
        heading: "5. Chargebacks and abuse",
        body: [
          "Please contact support before raising a chargeback so we can resolve the issue directly. Repeated chargebacks after a valid event may lead to account suspension.",
        ],
      },
    ],
  },
  {
    slug: "customer-service",
    title: "Customer Service",
    eyebrow: "We are here to help",
    summary:
      "How to reach the EventIQ team for ticket, order, entry or organizer support.",
    updated: UPDATED,
    sections: [
      {
        heading: "Contact channels",
        body: [
          "Email: support@eventiq.co.zw — best for order issues, refunds and account questions.",
          "In-app: signed-in attendees can use the Support link in the dashboard footer. Organizers can raise pricing or publishing questions from the organizer console.",
          "Gate emergencies: speak to the gate supervisor first. They can contact the EventIQ operations desk with your ticket code and order reference.",
        ],
      },
      {
        heading: "What to include",
        body: [
          "Your order reference (for example ORD-XXXXX), the ticket code if you have one, the event name and the email address on your account.",
          "A short description of what happened, including the time and gate if the issue relates to entry.",
        ],
      },
      {
        heading: "Response expectations",
        body: [
          "Order and payment questions: within one business day.",
          "Event-day entry issues: prioritized through the operations desk while the event is live.",
          "Organizer publishing and price-change requests: reviewed within two business days.",
        ],
      },
      {
        heading: "Accessibility",
        body: [
          "If you need an accessible entrance, companion ticket or other accommodation, contact the organizer through the event page as early as possible so arrangements can be made.",
        ],
      },
    ],
  },
  {
    slug: "kyc",
    title: "KYC Policy",
    eyebrow: "Organizer verification",
    summary:
      "How we verify organizers before they publish paid events, and what documents we ask for.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Why we verify",
        body: [
          "EventIQ verifies organizers to protect attendees from fraudulent listings and to meet payment partner requirements. Verification is required before an organizer can publish paid events.",
        ],
      },
      {
        heading: "2. What we collect",
        body: [
          "Business or trading name, business type, city and website where applicable.",
          "A company registration number for registered entities, or a national ID reference for sole traders and community organizers.",
          "A KYC document reference (for example a registration certificate or bank confirmation letter) and a description of the events the organizer intends to run.",
        ],
      },
      {
        heading: "3. Review process",
        body: [
          "Applications are reviewed by an EventIQ administrator. The reviewer may approve the application, request specific changes or reject it with a reason.",
          "Where changes are requested, the organizer can update the application and resubmit. Approval upgrades the account to the organizer role and allows draft events to enter event review.",
        ],
      },
      {
        heading: "4. Ongoing obligations",
        body: [
          "Organizers must keep their details current and notify EventIQ of a change of legal entity, bank account or trading name.",
          "We may re-verify an organizer after a dispute, a significant refund volume or a change in event profile. Failure to cooperate may result in suspension of publishing rights.",
        ],
      },
      {
        heading: "5. Data handling",
        body: [
          "KYC references are visible only to authorized administrators and are not shown to attendees. They are handled under our Privacy Policy and retained for as long as the organizer account is active.",
        ],
      },
    ],
  },
  {
    slug: "disputes",
    title: "Dispute Resolution",
    eyebrow: "Fair outcomes",
    summary:
      "The process for resolving disagreements between attendees, organizers and EventIQ.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Raise it early",
        body: [
          "Most issues can be resolved quickly with the organizer or support team. Contact the organizer through the event page for event-specific questions, or support@eventiq.co.zw for platform issues.",
          "Include your order reference, ticket code, event name and any supporting evidence such as screenshots or gate details.",
        ],
      },
      {
        heading: "2. Platform review",
        body: [
          "If the issue is not resolved, EventIQ will review the order, ticket and scan records. Administrators can see payment state, scan timestamps, gate names and audit history.",
          "We may ask both parties for information and will aim to reach a written outcome within ten business days of receiving a complete complaint.",
        ],
      },
      {
        heading: "3. Possible outcomes",
        body: [
          "A refund, a partial refund, a ticket reissue, or a decision that the original transaction stands. Decisions are recorded in the audit log.",
          "Where fraud or duplicate entry is suspected, we may suspend an account while the investigation is completed.",
        ],
      },
      {
        heading: "4. Escalation",
        body: [
          "If you remain dissatisfied, you may escalate to the relevant consumer protection authority in Zimbabwe. Nothing in this policy limits your statutory rights.",
        ],
      },
    ],
  },
  {
    slug: "promotions",
    title: "Promotions & Competitions",
    eyebrow: "Offers",
    summary:
      "Rules for discounts, promo codes, competitions and complimentary tickets offered through EventIQ.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Offer terms",
        body: [
          "Each promotion states its code, discount, eligibility, validity window and any quantity limits. Offers cannot be combined unless the promotion says so.",
          "Promotional tickets remain subject to event capacity, entry conditions and the organizer's refund rules.",
        ],
      },
      {
        heading: "2. Fair use",
        body: [
          "Codes may not be shared publicly, resold, automated or used to purchase inventory for resale. We may cancel orders that abuse a promotion.",
          "Complimentary or guest-list tickets must be issued through the platform so they carry a signed QR code and can be validated at the gate.",
        ],
      },
      {
        heading: "3. Competitions",
        body: [
          "Competition winners are selected using the method stated in the competition notice. Winners are notified using the contact details on their account.",
          "Prizes are non-transferable unless stated. Where a prize is a ticket, it is issued as a standard ticket and can be scanned once.",
        ],
      },
      {
        heading: "4. Changes",
        body: [
          "We may pause or end a promotion where required by law or where abuse is detected. Orders already completed under a valid promotion are honored.",
        ],
      },
    ],
  },
  {
    slug: "self-exclusion",
    title: "Responsible Attendance & Self-Exclusion",
    eyebrow: "Wellbeing",
    summary:
      "Options for taking a break from event marketing, transferring tickets and getting support at events.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Marketing controls",
        body: [
          "You can turn off marketing-style notifications from your profile while keeping essential order and ticket messages. You can also unsubscribe from promotional email using the link in the message.",
        ],
      },
      {
        heading: "2. Taking a break",
        body: [
          "If you would like to pause your account, contact support. We can disable promotional contact and, where appropriate, suspend the account while keeping your order history for dispute purposes.",
        ],
      },
      {
        heading: "3. Ticket transfers",
        body: [
          "Where an organizer allows transfers, you may share a ticket code with a trusted guest. The code is admitted once, so only share it with the person who will attend.",
        ],
      },
      {
        heading: "4. At the event",
        body: [
          "If you feel unwell or unsafe, speak to the gate supervisor or venue welfare team. Event organizers are responsible for on-site safety and first aid arrangements.",
        ],
      },
    ],
  },
  {
    slug: "organizer-agreement",
    title: "Organizer Agreement",
    eyebrow: "For organizers",
    summary:
      "The operating agreement for organizers who publish and sell tickets on EventIQ.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Publishing",
        body: [
          "Organizers may create draft events and submit them for review. An event is only visible to attendees after an EventIQ administrator approves it.",
          "Listings must accurately describe the event, date, venue, ticket tiers and any age or entry restrictions. Capacity must reflect the venue's lawful limit.",
        ],
      },
      {
        heading: "2. Pricing and changes",
        body: [
          "Ticket prices are set by the organizer. After an event is approved, price changes require an administrator-approved price request so attendees see a consistent, auditable price history.",
          "Organizers may not create duplicate listings for the same event to circumvent review.",
        ],
      },
      {
        heading: "3. Inventory and settlement",
        body: [
          "EventIQ reserves inventory atomically during checkout and releases expired orders automatically. Organizers must not oversell beyond the capacity declared in the listing.",
          "In this demonstration environment, settlements are simulated. A live deployment would settle net ticket value to the organizer after deductions for the platform commission and any refunds.",
        ],
      },
      {
        heading: "4. Gate operations",
        body: [
          "Organizers must keep their gate assignments and event details current, and ensure staff use EventIQ scanning so every accepted ticket is recorded once.",
          "Manual admission without a scan should be documented and reported to EventIQ so the entry record remains accurate.",
        ],
      },
      {
        heading: "5. Cancellations and conduct",
        body: [
          "Organizers must notify EventIQ before cancelling an approved event and must cooperate with attendee refunds. Repeated cancellations or misrepresentation may lead to removal from the platform.",
        ],
      },
    ],
  },
];

export function getPolicy(slug: string) {
  return POLICIES.find((policy) => policy.slug === slug);
}
