# Upshot OS

This is the GitHub-ready export of the full Manus application.

## Deploy to Vercel

1. Create a new GitHub repository, such as `upshot-os-app`.
2. Upload the contents of this folder to the repository root.
3. Import that repository into Vercel as a new project.
4. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy and test the temporary Vercel URL.
6. After validation, attach `demo.upshottheory.com` to this Vercel project.

Do not commit a real `.env` file or any Supabase service-role key. The browser app should use only the publishable/anon key.
