// Port of TermsContent: the terms/EULA + community-guidelines copy shown on
// the Accept Terms gate and in the login page's "read the terms" sheet.
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "Agreement to Terms",
    body: "By creating an account or signing in, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use HitLit.",
  },
  {
    heading: "User-Generated Content & Zero Tolerance Policy",
    body: "HitLit lets you chat, post, and interact with other players. We have zero tolerance for objectionable content or abusive behavior of any kind — including harassment, hate speech, threats, nudity, spam, and anything illegal. Content and conduct that violate this policy are not permitted anywhere in the app.",
  },
  {
    heading: "Reporting & Blocking",
    body: 'You can report any message, post, or profile you believe violates this policy by pressing and holding it (or using the options menu on a profile) and selecting "Report." You can block any user from the same menu — blocking immediately removes that person\'s content from your own feed and chats.',
  },
  {
    heading: "Our Commitment to Moderation",
    body: "We review every report. Where content is found to violate this policy, we remove it and may suspend or permanently remove the responsible user's access to HitLit, generally within 24 hours of a report being submitted.",
  },
  {
    heading: "Account Responsibility",
    body: "You are responsible for the content you post and for your conduct toward other users. Repeated or severe violations will result in account suspension without notice.",
  },
  {
    heading: "Privacy",
    body: "We collect only the information needed to run HitLit — your profile details, location (to show nearby games/venues), and the messages you send. Chat messages are automatically deleted 24 hours after being sent. We do not sell your personal data. See our full Privacy Policy for details.",
  },
  {
    heading: "Changes",
    body: "We may update these terms from time to time. Continued use of HitLit after a change means you accept the updated terms.",
  },
];

export default function TermsContent() {
  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map((s) => (
        <section key={s.heading}>
          <h3 className="mb-1 text-[14.5px] font-bold text-ink">{s.heading}</h3>
          <p className="text-[13px] leading-[19px] text-muted">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
