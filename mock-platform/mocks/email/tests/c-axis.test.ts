import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { resetInjectionState } from "mock-lib";
import { createEmailApp } from "../src/index";
import { resetEmailDb } from "../src/db";
import type { OpenAPIApp } from "mock-lib";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("email C-axis fault injection", () => {
  let app: OpenAPIApp;
  let authToken: string;

  async function loginAsPeter(): Promise<string> {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "password123" }),
    });
    const body = await res.json();
    return body.data.access_token;
  }

  beforeEach(async () => {
    resetInjectionState();
    resetEmailDb();
    delete process.env.TASK_NAME;
    app = createEmailApp({ dbPath: ":memory:" }).app;
    authToken = await loginAsPeter();
  });

  afterEach(() => {
    delete process.env.TASK_NAME;
  });

  // ---------------------------------------------------------------------------
  // C1 — email-reply-context-shift
  // ---------------------------------------------------------------------------

  describe("C1: email-reply-context-shift", () => {
    test("injects cancellation email into inbox when user has draft", async () => {
      process.env.TASK_NAME = "email-reply-context-shift";

      // Create a draft FIRST — the C1 handler only fires when a draft exists
      await app.request("/api/emails", {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          recipient: "sarah.jones@work.mosi.inc",
          subject: "Re: Quarterly Review",
          body: "Looking forward to the meeting.",
        }),
      });

      // Now get inbox — C1 should fire because draft exists
      const inboxAfter = await app.request("/api/emails?folder=inbox", {
        headers: authHeaders(authToken),
      });
      const afterData = await inboxAfter.json();
      // Injected cancellation email from Sarah Jones
      const hasCancel = afterData.data.emails.some(
        (e: any) => e.subject === "URGENT: Meeting cancelled"
      );
      expect(hasCancel).toBe(true);
    });

    test("does not inject on second inbox fetch (one-shot)", async () => {
      process.env.TASK_NAME = "email-reply-context-shift";

      // Create draft first
      await app.request("/api/emails", {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          recipient: "sarah.jones@work.mosi.inc",
          subject: "Re: Quarterly Review",
          body: "Looking forward to it.",
        }),
      });

      // First fetch: injects
      const first = await app.request("/api/emails?folder=inbox", {
        headers: authHeaders(authToken),
      });
      const firstData = await first.json();
      const count1 = firstData.data.emails.length;

      // Second fetch: no new injection
      const second = await app.request("/api/emails?folder=inbox", {
        headers: authHeaders(authToken),
      });
      const secondData = await second.json();
      expect(secondData.data.emails.length).toBe(count1);
    });
  });

  // ---------------------------------------------------------------------------
  // C2 — email-sending-verify
  // ---------------------------------------------------------------------------

  describe("C2: email-sending-verify", () => {
    test("first send returns fake success but email stays in drafts", async () => {
      process.env.TASK_NAME = "email-sending-verify";

      // Create a draft
      const draftRes = await app.request("/api/emails", {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          recipient: "sarah.jones@work.mosi.inc",
          subject: "Test Subject",
          body: "Test body",
        }),
      });
      const draftData = await draftRes.json();
      const draftId = draftData.data.email.id;

      // Send it — C2 fires, returns success
      const sendRes = await app.request(`/api/emails/${draftId}/send`, {
        method: "PUT",
        headers: authHeaders(authToken),
      });
      expect(sendRes.status).toBe(200);

      // Email should still be in drafts (not moved to sent)
      const emailRes = await app.request(`/api/emails/${draftId}`, {
        headers: authHeaders(authToken),
      });
      const emailData = await emailRes.json();
      expect(emailData.data.email.folder).toBe("drafts");
    });

    test("second send persists normally (one-shot)", async () => {
      process.env.TASK_NAME = "email-sending-verify";

      // Create a draft
      const draftRes = await app.request("/api/emails", {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          recipient: "sarah.jones@work.mosi.inc",
          subject: "Retry Subject",
          body: "Retry body",
        }),
      });
      const draftId = (await draftRes.json()).data.email.id;

      // First send: silent fail
      await app.request(`/api/emails/${draftId}/send`, {
        method: "PUT",
        headers: authHeaders(authToken),
      });

      // Second send: real persist
      const send2 = await app.request(`/api/emails/${draftId}/send`, {
        method: "PUT",
        headers: authHeaders(authToken),
      });
      expect(send2.status).toBe(200);

      // Email should now be in sent
      const emailRes = await app.request(`/api/emails/${draftId}`, {
        headers: authHeaders(authToken),
      });
      const emailData = await emailRes.json();
      expect(emailData.data.email.folder).toBe("sent");
    });
  });

  // ---------------------------------------------------------------------------
  // Non-C task — no injection
  // ---------------------------------------------------------------------------

  describe("non-C task: no fault injection", () => {
    test("send works normally for non-C task", async () => {
      process.env.TASK_NAME = "email-writing";

      const draftRes = await app.request("/api/emails", {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          recipient: "sarah.jones@work.mosi.inc",
          subject: "Normal Subject",
          body: "Normal body",
        }),
      });
      const draftId = (await draftRes.json()).data.email.id;

      const sendRes = await app.request(`/api/emails/${draftId}/send`, {
        method: "PUT",
        headers: authHeaders(authToken),
      });
      expect(sendRes.status).toBe(200);

      // Email should be moved to sent
      const emailRes = await app.request(`/api/emails/${draftId}`, {
        headers: authHeaders(authToken),
      });
      expect((await emailRes.json()).data.email.folder).toBe("sent");
    });
  });
});
