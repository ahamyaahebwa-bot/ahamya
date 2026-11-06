# Cedar Park: new gallery page + staff dashboard

What you get

- `gallery.html` : the public gallery page (photos fill the screen, each keeps its own shape)
- `admin/` : the private dashboard (login, Booked dates page, Gallery page)
- `js/staff-tick.js` : the small tick that leads to the login
- `supabase-setup.sql` : one script that prepares the database

Photos and logins are stored in **Supabase** (free). Do Part 1 once.

---

## Part 1: Set up Supabase (about 15 minutes, once)

1. Go to **supabase.com**, create a free account, then **New project**.
   Name it `cedar-park`, set a database password (save it somewhere), pick the region closest to Uganda
   (for example "Europe" if there is nothing nearer), and create it. Wait a minute while it starts.
2. In the left menu open **SQL Editor > New query**. Open `supabase-setup.sql` from this folder,
   copy **everything**, paste it in and press **Run**. It should say "Success".
3. Open **Project Settings > API** (or "Data API"). Copy:
   - **Project URL**
   - the **anon / public** key (the long one. Never use the `service_role` key.)
4. Open `js/supabase-config.js` and paste them between the quotes:
   `supabaseUrl` and `supabaseAnonKey`. Also paste your Google Sheet link into `sheetEditUrl`
   if you want the "Open sheet" button.
5. Create **your** login: **Authentication > Users > Add user > Create new user**.
   Enter your email and a strong password, and tick **Auto Confirm User**.
6. Make sure nobody else can register: **Authentication > Sign In / Providers** (the page that
   lists "Email") and turn **OFF** "Allow new users to sign up". Save.

## Part 2: Add the files to your website

1. **Delete your old `admin` folder** (the one you don't like), then copy in the new `admin` folder.
2. Copy `gallery.html` next to `index.html`.
3. Copy `css/gallery-page.css`, `js/gallery-page.js`, `js/supabase-config.js` and `js/staff-tick.js`
   into your `css` and `js` folders.
4. `supabase-setup.sql` and `SETUP.md` do not need to go on the website.

## Part 3: Small edits to your existing files

**a) The staff tick.** In `index.html`, `about.html`, `venue.html`, `booking.html` and `contact.html`,
add this line just above `</body>`:

```html
<script src="js/staff-tick.js" defer></script>
```

**b) Keep "Venues" highlighted when you are on the gallery page.** In `js/script1.js`, replace

```js
const active = links.find(a => file(a) === current) || links[0];
```
with
```js
const alias = { "gallery.html": "venue.html" };
const active = links.find(a => file(a) === (alias[current] || current)) || links[0];
```

**c) Point your gallery buttons to the new page.** Find these links and change them:

- the round gallery button: `venue.html?gallery=all#gallery` becomes `gallery.html`
- the "View Venue" / "View Hall" cards on the home page keep working as they are.

**d) Optional "See all photos" button on the Venues page**, under your small gallery:

```html
<div class="gal-more">
    <a href="gallery.html" class="btn primary-btn">See all photos</a>
</div>
```
with `.gal-more { text-align: center; margin-top: 24px; }` added to `css/gallery.css`.

**e) Offline support (optional).** In `sw.js` add `"gallery.html",` to the `SHELL_FILES` list.

## Part 4: Try it

1. Open your site, scroll to the bottom and tap the small **tick** (bottom-right corner on a laptop,
   next to the copyright line on a phone).
2. Sign in with the email and password from Part 1, step 5.
3. **Gallery > Add photos**: choose Venue or Hall, then drop or pick photos.
4. Open `gallery.html` to see them.

## Good to know

- Photos are resized to about 2000 px on the longest side before upload, so they load fast and
  stay inside the free storage limit.
- Free Supabase projects pause after about a week with no visits. Visitors to your gallery page count
  as activity. If it ever pauses, open the project in Supabase and press **Restore**.
- The login page can't be hidden (nothing on a static site can be), but only your account can get in.
  Keep your password private. If you forget it: Supabase > Authentication > Users.
- To add another staff member: Authentication > Users > Add user.
