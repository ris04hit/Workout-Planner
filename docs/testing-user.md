# Testing User Guide

When you need to manually test a feature, UI behaviour, or bug fix, **never use your real user**.
Instead: create a dedicated test user → test → delete it. Your production data stays untouched.

This file is gitignored — for personal reference only.

---

## The Rule

> All manual testing must be done under a test user.  
> The test user must be deleted when testing is complete.  
> Production user data must never be edited directly.

---

## Workflow

### 1. Create the test user

**Via the UI:**
1. Open the app at `http://localhost:5000`
2. Click your username in the top panel → **Manage Users**
3. Click **Create User**, enter `_test` (or any name you'll recognise)
4. Tick **Copy from default** so it starts with a full exercise list and config
5. Click **Create**

**Via the API (curl / browser):**
```
POST http://localhost:5000/api/users
Content-Type: application/json

{ "username": "_test", "copy_from_default": true }
```

**Recommended test username:** `_test` — the leading underscore makes it visually distinct from real users.

---

### 2. Switch to the test user

**Via the UI:** Click your username → select `_test` from the switcher.

**Via URL:** Append `?user=_test` to the app URL:
```
http://localhost:5000/?user=_test
```

All API calls from the browser will now use `_test` because the username is stored in `localStorage`.

---

### 3. Do your testing

You are free to:
- Log fake workouts
- Change config values
- Add/remove/disable exercises
- Test edge cases (duplicate workouts, empty sets, soreness combinations)
- Test the suggestion algorithm with specific history states
- Test import/export

Everything is isolated to `data/users/_test/`. Nothing touches your real user's files.

---

### 4. Delete the test user when done

**Via the API:**
```
DELETE http://localhost:5000/api/users/_test
```

Or using curl:
```bash
curl -X DELETE http://localhost:5000/api/users/_test
```

This removes `_test` from `data/users.json` and deletes `data/users/_test/` and all its contents.

**Verify it's gone:**
```
GET http://localhost:5000/api/users
```
The response should no longer include `_test`.

---

### 5. Switch back to your real user

**Via the UI:** Click the username dropdown → select your real user.

---

## Quick Reference

| Step | Action |
|---|---|
| Create | `POST /api/users` `{ "username": "_test", "copy_from_default": true }` |
| Switch | Click user switcher in UI, or append `?user=_test` to URL |
| Test | Do whatever you need — all data goes to `data/users/_test/` |
| Delete | `DELETE /api/users/_test` |
| Switch back | Click user switcher → select your real user |

---

## What is protected

- `data/users/<your-real-user>/` — your workout history, config, exercises
- `data/users.json` — user list (test user is removed on delete)
- `data/default/` — template data, never modified by user actions

The test user's directory is automatically created on first write and automatically deleted when you call `DELETE /api/users/_test`. No manual file cleanup needed.

---

## If you forget to delete

Run the app, open the user switcher, confirm `_test` is not your active user, then:

```
DELETE http://localhost:5000/api/users/_test
```

Or manually delete `data/users/_test/` and remove `"_test"` from `data/users.json`.
