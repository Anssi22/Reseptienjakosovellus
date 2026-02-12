import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import mongoose from "mongoose";
import Resepti from "./models/Resepti.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB:", error);
    process.exit(1);
  });


// --- Apufunktio: query -> lista ainesosia (normalisoituna) ---
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const parseAinesosatQuery = (q) => {
  // tuetaan esim:
  // ?ainesosat=kana,sipuli
  // ?ainesosat=kana&ainesosat=sipuli
  // ?ainesosat[]=kana&ainesosat[]=sipuli (jos joskus tulee)
  let raw = q.ainesosat ?? q["ainesosat[]"];
  if (!raw) return [];

  if (Array.isArray(raw)) return raw.map(norm).filter(Boolean);

  return String(raw)
    .split(",")
    .map(norm)
    .filter(Boolean);
};

// --- ROUTET ---

// GET /api/recipes
// - ilman queryä: kaikki
// - ?ainesosat=kana,sipuli -> reseptit joissa on KAIKKI (AND)
app.get("/api/recipes", async (req, res, next) => {
  try {
    const ainesosat = parseAinesosatQuery(req.query);

    const filter =
      ainesosat.length > 0
        ? { ainesosatNorm: { $all: ainesosat } }
        : {};

    const recipes = await Resepti.find(filter).sort({ luotu: -1 });
    res.json(recipes);
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/:id (detail-näkymää varten)
app.get("/api/recipes/:id", async (req, res, next) => {
  try {
    const recipe = await Resepti.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Reseptiä ei löytynyt" });
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes
app.post("/api/recipes", async (req, res, next) => {
  try {
    // ainesosatNorm muodostuu automaattisesti schema-hookissa (pre validate)
    const recipe = new Resepti(req.body);
    const savedRecipe = await recipe.save();
    res.status(201).json(savedRecipe);
  } catch (err) {
    next(err);
  }
});

// HELPOIN päivitys: findById -> aseta kentät -> save()
// Tämä varmistaa, että pre('validate') ajetaan ja ainesosatNorm päivittyy
app.put("/api/recipes/:id", async (req, res, next) => {
  try {
    const recipe = await Resepti.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Reseptiä ei löytynyt" });

    // Päivitä vain ne kentät joita haluat sallia frontilta
    recipe.otsikko = req.body.otsikko ?? recipe.otsikko;
    recipe.kuvaus = req.body.kuvaus ?? recipe.kuvaus;
    recipe.ainesosat = req.body.ainesosat ?? recipe.ainesosat;
    recipe.ohjeet = req.body.ohjeet ?? recipe.ohjeet;

    // (jos sallit kommenttien/arvioiden päivityksen suoraan PUTilla, lisää tähän,
    // mutta yleensä parempi omat endpointit niille)

    const saved = await recipe.save(); // -> triggeröi validate-hookit
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recipes/:id
app.delete("/api/recipes/:id", async (req, res, next) => {
  try {
    const deletedRecipe = await Resepti.findByIdAndDelete(req.params.id);
    if (!deletedRecipe)
      return res.status(404).json({ error: "Reseptiä ei löytynyt" });
    res.json(deletedRecipe);
  } catch (err) {
    next(err);
  }
});

// Reseptin kommentointi lisää
// POST /api/recipes/:id/comments  { teksti: "..." }
app.post("/api/recipes/:id/comments", async (req, res, next) => {
  try {
    const recipe = await Resepti.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Reseptiä ei löytynyt" });

    const teksti = String(req.body.teksti ?? "").trim();
    if (!teksti) return res.status(400).json({ error: "Kommentti puuttuu" });

    recipe.kommentit.push({ teksti });
    const saved = await recipe.save(); // save() -> validate hookit ajetaan
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// REseptin arvostelu lisää
// POST /api/recipes/:id/ratings  { arvo: 1..5 }
app.post("/api/recipes/:id/ratings", async (req, res, next) => {
  try {
    const recipe = await Resepti.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Reseptiä ei löytynyt" });

    const arvo = Number(req.body.arvo);
    if (!Number.isFinite(arvo) || arvo < 1 || arvo > 5) {
      return res.status(400).json({ error: "Arvon pitää olla 1–5" });
    }

    recipe.arviot.push({ arvo });

    // Päivitä keskiarvo + määrä (helpottaa UI:ta)
    recipe.arvioMaara = recipe.arviot.length;
    recipe.arvioKeskiarvo =
      recipe.arvioMaara === 0
        ? 0
        : recipe.arviot.reduce((sum, a) => sum + a.arvo, 0) / recipe.arvioMaara;

    const saved = await recipe.save(); // save() -> validate hookit 
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});


// --- Virheenkäsittely (Express error handler) ---
app.use((err, req, res, next) => {
  console.error(err);

  // Mongoose validointivirheet (esim. required/min/max)
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "Validointivirhe", details: err.message });
  }

  // Virheellinen ObjectId tms.
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Virheellinen id" });
  }

  res.status(500).json({ error: "Palvelinvirhe" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
