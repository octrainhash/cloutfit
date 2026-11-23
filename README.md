# Cloutfit

Your closet in your pocket. Photograph your clothes and Cloutfit cuts them out and works out the colour. Style outfits on a peach mannequin or as a flat lay, save looks, log what you wear, and see your own clothes on a photo of you with AI try-on.

- **Closet**: scan many photos at once, with automatic background removal and colour naming. Filter by category or colour, search, add favourites, and see wear counts.
- **Style**: tap clothes to dress the mannequin. They snap to the right place: drag to move, pinch or drag the corner to resize, two fingers to rotate. Switch between the Mannequin and Flat lay layouts. Shuffle makes a random outfit.
- **Looks**: saved outfits with images. Log "Wore it today", share, edit, or send a look to try-on.
- **Try on**: photo-real try-on by [FASHN](https://fashn.ai) (about $0.075 per garment). Add a FASHN API key in Settings for personal use. For a public release, deploy `server/tryon` as a Supabase Edge Function so the key stays on the server.

Everything is stored on the device (IndexedDB). There is backup and restore in Settings.

The mannequin is rendered from MakeHuman's CC0 base mesh.
