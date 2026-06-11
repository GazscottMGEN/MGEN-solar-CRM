# MGEN CRM V9 - PDF Sales Proposal

Upload the CONTENTS of this folder to GitHub.

V9 adds:
- Download Proposal PDF button using jsPDF
- A4 portrait sales proposal structure
- Accreditation logo strip support
- Blue Drop Insurance Backed Warranty section
- Roof/photo file display inside proposal preview
- Investment section
- Customer acceptance/signature section
- Better proposal layout for PDF

No new Supabase SQL is required if V7/V8 are already working.

## Accreditation logos

Add these files into `public/accreditations/` before uploading to GitHub if you have them:

- mcs-logo.png
- napit-logo.png
- blue-drop-logo.png
- recc-logo.png
- trustmark-logo.png

If a logo is missing, the CRM will show a text badge instead.

## Proposal images

Optional:
- Add a good solar/drone image as `public/proposal-images/solar-hero.jpg`

## After upload

1. Upload the CONTENTS of this folder to GitHub.
2. Commit changes.
3. Wait for Vercel to redeploy.
4. Open CRM.
5. Go to Proposals.
6. Click Preview.
7. Click Download Proposal PDF.
