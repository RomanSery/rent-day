import { ContactMessage } from "@core/types/ContactMessage";

/** Contact Us messages in D1 (see migrations/0007_contact.sql). */
export class ContactRepo {
  constructor(private readonly db: D1Database) {}

  async insert(msg: ContactMessage): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO contact_messages (id, created_at, email, name, subject, message, user_id, username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(msg.id, msg.createdAt, msg.email, msg.name, msg.subject, msg.message, msg.userId ?? null, msg.username ?? null)
      .run();
  }

  /** Messages received since then (ISO), for the daily cap. */
  async countSince(sinceIso: string): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM contact_messages WHERE created_at > ?`)
      .bind(sinceIso)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  /** Newest first. */
  async list(limit: number): Promise<ContactMessage[]> {
    const result = await this.db
      .prepare(
        `SELECT id, created_at, email, name, subject, message, user_id, username
         FROM contact_messages ORDER BY created_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<{
        id: string; created_at: string; email: string; name: string; subject: string;
        message: string; user_id: string | null; username: string | null;
      }>();
    return (result.results ?? []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      email: r.email,
      name: r.name,
      subject: r.subject,
      message: r.message,
      userId: r.user_id ?? undefined,
      username: r.username ?? undefined,
    }));
  }

  async remove(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM contact_messages WHERE id = ?`).bind(id).run();
  }
}
