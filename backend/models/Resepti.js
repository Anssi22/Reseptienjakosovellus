import mongoose from "mongoose";

const ainesosaSchema = new mongoose.Schema(
  {
    nimi: { type: String, required: true, trim: true },
    maara: { type: String, trim: true },  // esim. "2", "1/2"
    yksikko: { type: String, trim: true } // esim. "kpl", "dl", "g"
  },
  { _id: false }
);

const kommenttiSchema = new mongoose.Schema(
  {
    teksti: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    luotu: { type: Date, default: Date.now }
  },
  { _id: false }
);

const arvioSchema = new mongoose.Schema(
  {
    arvo: { type: Number, required: true, min: 1, max: 5 },
    luotu: { type: Date, default: Date.now }
  },
  { _id: false }
);

const reseptiSchema = new mongoose.Schema(
  {
    otsikko: { type: String, required: true, trim: true, maxlength: 120 },
    kuvaus: { type: String, trim: true, maxlength: 300 },

    // Rakenne ainesosille (parempi kuin "type: Array")
    ainesosat: { type: [ainesosaSchema], required: true },

    // Hakuun optimoitu kenttä: pelkät nimet normalisoituna (lowercase, trim)
    ainesosatNorm: { type: [String], required: true, index: true },

    ohjeet: { type: String, required: true, trim: true, minlength: 1 },

    kommentit: { type: [kommenttiSchema], default: [] },

    arviot: { type: [arvioSchema], default: [] },
    arvioKeskiarvo: { type: Number, default: 0, min: 0, max: 5 },
    arvioMaara: { type: Number, default: 0, min: 0 }
  },
  { timestamps: { createdAt: "luotu", updatedAt: "paivitetty" } }
);

// Hyöty:
// - Pidetään hakua varten "ainesosatNorm" aina ajantasalla.
// - Ainesoshaku on nopea ja yksinkertainen, kun verrataan pelkkiä normalisoituja nimiä.
// - Et joudu tekemään tätä logiikkaa jokaisessa controllerissa erikseen.
//
// Tämä on Mongoose "pre hook" validate-vaiheeseen:
// se ajetaan automaattisesti ennen dokumentin validointia (ja save() laukaisee validoinnin) [page:0].
reseptiSchema.pre("validate", async function () {
  // Normalisointifunktio:
  // - muuttaa arvon stringiksi (myös null/undefined-safe)
  // - pienet kirjaimet
  // - trimmaa alusta/lopusta
  // - vaihtaa useat välilyönnit yhdeksi
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  // Muodostetaan ainesosatNorm ainesosat-taulukosta:
  // - otetaan ainesosan nimi (a.nimi)
  // - normalisoidaan se
  // - poistetaan tyhjät (filter(Boolean))
  //
  // HUOM: käytetään tavallista function() { } eikä nuolifunktiota,
  // koska Mongoose asettaa `this`-viitteen dokumenttiin nimenomaan näin [page:0].
  this.ainesosatNorm = (this.ainesosat || [])
    .map((a) => norm(a.nimi))
    .filter(Boolean);
});


export default mongoose.model("Resepti", reseptiSchema);
