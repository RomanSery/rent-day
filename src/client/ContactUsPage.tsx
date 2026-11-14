import React from "react";
import { Button, TextField, FormControl, InputLabel, NativeSelect, Typography } from "@mui/material";
import { BackLink } from "./components/BackLink";
import API from "./api";
import { isLoggedIn } from "./helpers";
import { CONTACT_SUBJECTS } from "../core/types/ContactMessage";

const MAX_MESSAGE = 2000;

/** The server's reason for refusing, from a validation error or a plain-text reply. */
const errorText = (error: any): string => {
  const data = error?.response?.data;
  if (data?.errors?.length) {
    return data.errors[0].msg;
  }
  if (typeof data === "string" && data) {
    return data;
  }
  return "Couldn't send your message. Please try again.";
};

/** Contact Us: messages are stored by POST /api/contact and read on /admin/messages. */
export const ContactUsPage: React.FC = () => {

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  // never shown: only bots fill it in
  const [website, setWebsite] = React.useState("");

  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) {
      return;
    }
    setSending(true);
    setError("");
    API.post("contact", { email, name, subject, message, website })
      .then(() => {
        setSent(true);
        setMessage("");
        setSubject("");
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setSending(false));
  };

  return (
    <div className="contact-page">

      <BackLink to={isLoggedIn() ? "/dashboard" : "/auth"} label={isLoggedIn() ? "Lobby" : "Back"} />

      <Typography component="h2" variant="h5">Contact Us</Typography>

      {sent ? (
        <div className="contact-sent" role="status">
          <p><strong>Thanks for your message!</strong> We'll reply to {email} as soon as we can.</p>
          <Button variant="outlined" onClick={() => setSent(false)}>Send another message</Button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={onSubmit} noValidate={false}>
          <TextField label="Your email" type="email" fullWidth required name="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} slotProps={{ htmlInput: { maxLength: 254 } }} />

          <TextField label="Your name" fullWidth name="name" autoComplete="name"
            value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }} />

          <FormControl fullWidth required>
            <InputLabel htmlFor="contact-subject" shrink>Subject</InputLabel>
            <NativeSelect id="contact-subject" name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="" disabled>Pick one</option>
              {Object.entries(CONTACT_SUBJECTS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </FormControl>

          <TextField label="Your message" fullWidth required multiline minRows={5} name="message"
            value={message} onChange={(e) => setMessage(e.target.value)}
            helperText={`${message.length} / ${MAX_MESSAGE}`}
            slotProps={{ htmlInput: { maxLength: MAX_MESSAGE } }} />

          {/* honeypot: hidden from people, tempting to bots */}
          <input className="contact-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
            value={website} onChange={(e) => setWebsite(e.target.value)} />

          {error && <p className="contact-error" role="alert">{error}</p>}

          <div>
            <Button variant="contained" color="primary" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>
      )}

    </div>
  );
}
