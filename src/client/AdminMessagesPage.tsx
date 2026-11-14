import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReply, faRotateRight, faTrash } from "@fortawesome/free-solid-svg-icons";
import API from "./api";
import { BackLink } from "./components/BackLink";
import { handleApiError } from "./helpers";
import { CONTACT_SUBJECTS, ContactMessage } from "../core/types/ContactMessage";
import { profileFrom } from "./join/PlayerProfilePage";

const when = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** Contact Us messages, newest first. Only for ADMIN_EMAILS accounts (the API answers 404 to anyone else). */
export const AdminMessagesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery<ContactMessage[], any>({
    queryKey: ["adminMessages"],
    queryFn: () => API.post("admin/messages").then((r) => r.data.messages),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const onDelete = (msg: ContactMessage) => {
    if (!window.confirm(`Delete the message from ${msg.email}? This can't be undone.`)) {
      return;
    }
    API.post("admin/messages/delete", { id: msg.id })
      .then(() => queryClient.setQueryData<ContactMessage[]>(["adminMessages"], (old) => (old ?? []).filter((m) => m.id !== msg.id)))
      .catch(handleApiError);
  };

  const messages = query.data ?? [];

  const body = () => {
    if (query.isError) {
      return query.error?.response?.status === 404
        ? <p className="lb-note">This page is only for the site's admins.</p>
        : <p className="lb-note">Couldn't load the messages: {query.error?.message}</p>;
    }
    if (query.isLoading) {
      return <p className="lb-note">Loading messages&hellip;</p>;
    }
    if (messages.length === 0) {
      return <p className="lb-note">No messages yet.</p>;
    }
    return (
      <ul className="inbox-list">
        {messages.map((m) => {
          const subject = CONTACT_SUBJECTS[m.subject] ?? m.subject;
          return (
            <li key={m.id} className="inbox-item">
              <header className="inbox-head">
                <span className={"inbox-subject s-" + m.subject}>{subject}</span>
                <span className="inbox-from">
                  {m.name ? <b>{m.name}</b> : null} &lt;{m.email}&gt;
                  {m.userId && <> · account <Link to={"/profile/" + m.userId} state={profileFrom("/admin/messages", "Messages")}>{m.username ?? "profile"}</Link></>}
                </span>
                <span className="inbox-when">{when(m.createdAt)}</span>
              </header>
              <p className="inbox-text">{m.message}</p>
              <div className="inbox-actions">
                <Button size="small" variant="outlined" startIcon={<FontAwesomeIcon icon={faReply} />}
                  href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: " + subject + " (Block Barons)")}`}>
                  Reply by email
                </Button>
                <Button size="small" color="error" startIcon={<FontAwesomeIcon icon={faTrash} />} onClick={() => onDelete(m)}>
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="profile inbox">
      <header className="gl-head">
        <div>
          <BackLink to="/dashboard" label="Lobby" />
          <h1>Messages</h1>
          <p className="gl-sub">{query.isSuccess ? `${messages.length} ${messages.length === 1 ? "message" : "messages"} from the Contact Us page` : " "}</p>
        </div>
        <div className="gl-actions">
          <Button variant="outlined" size="small" onClick={() => query.refetch()} disabled={query.isFetching}
            startIcon={<FontAwesomeIcon icon={faRotateRight} spin={query.isFetching} />}>
            Refresh
          </Button>
        </div>
      </header>
      {body()}
    </div>
  );
};
