"use client";

import { Mail, Phone, MessageCircle, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const faqs = [
  { q: "How do I run payroll for the current month?", a: "Go to Payroll Run, select the month, validate employee data, then follow the guided steps through calculation, review and approval." },
  { q: "How can I publish payslips to employees?", a: "From the Payslips page, use the Publish Payslips quick action to make payslips visible to employees in the mobile app." },
  { q: "How do I add a new salary structure?", a: "Navigate to Salary Structures and click Create Structure. Define earnings and deduction components, then save and assign it to employees." },
  { q: "Where can I download financial reports?", a: "Visit Financial Reports to generate and download Trial Balance, P&L, Balance Sheet and other statutory reports." },
];

export default function SupportPage() {
  return (
    <div>
      <PageHeader title="Support" subtitle="Get help with payroll, HR and accounting features." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <SectionCard title="Frequently Asked Questions">
          <Accordion>
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Contact Support">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-primary" /> support@payflow.com
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-primary" /> +91 1800 123 4567
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <MessageCircle className="h-4 w-4 text-primary" /> Live chat available 9am–7pm IST
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Raise a Ticket">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Support ticket submitted", { description: "Our team will get back to you within 24 hours." });
                (e.target as HTMLFormElement).reset();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="Briefly describe the issue" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="Provide more details..." rows={4} required />
              </div>
              <Button type="submit" className="w-full gap-1.5">
                <LifeBuoy className="h-4 w-4" /> Submit Ticket
              </Button>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
