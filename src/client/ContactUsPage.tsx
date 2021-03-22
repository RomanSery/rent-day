import React from "react";
import { Button, TextField, FormControl, InputLabel, NativeSelect, Typography } from "@material-ui/core";



interface Props {

}

export const ContactUsPage: React.FC<Props> = () => {

  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (window.location.search.includes('success=true')) {
      setSuccess(true);
    }
  }, []);

  return (
    <React.Fragment>

      <Typography component="h2" variant="h5">Contact Us</Typography>

      {success && (
        <p>Thanks for your message! We will get back to you soon.</p>
      )}

      <form name="contact-us" method="POST" data-netlify="true" action="/contact/?success=true">
        <input type="hidden" name="form-name" value="contact-us" />
        <TextField label="Your Email" fullWidth={true} name="youremail" required={true} />

        <TextField label="Your Name" fullWidth={true} name="yourname" />

        <FormControl fullWidth >
          <InputLabel htmlFor="class-type">Subject</InputLabel>
          <NativeSelect name="subject" required={true} fullWidth={true}>
            <option aria-label="None" value="" />
            <option value="general">General</option>
            <option value="feedback">Feedback / Suggestions</option>
            <option value="questions">Questions</option>
            <option value="bugs">Bug Report</option>
            <option value="other">Other</option>
          </NativeSelect>
        </FormControl>

        <br />
        <br />


        <textarea name="msg" placeholder="Your message" className="contact-us-msg" rows={5}></textarea>


        <Button variant="contained" color="primary" type="submit">Submit</Button>
      </form>

    </React.Fragment>
  );
}
