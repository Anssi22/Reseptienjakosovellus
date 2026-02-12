<script>


  import { onMount } from "svelte";

  const API = import.meta.env.VITE_API_URL;

  let reseptit = [];
  let loading = false;
  let error = "";

  // Haku
  let ainesosaHaku = ""; // esim: "kana,sipuli"

  // Lomake
  let otsikko = "";
  let kuvaus = "";
  let ohjeet = "";
  let ainesosatText = "";

  // Parsitaan ainesosat tekstistä objektiksi joka lähtee bäkkärille
  // split pilkkoo tekstin rivinvaihdoista listaksi
  // trim tyhjät pois
  // filter(Boolean) poistaa tyhjät rivit
  const parseAinesosat = (text) =>
    text
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((row) => {
        const [nimi, maara, yksikko] = row
          .split(";")
          .map((x) => (x ?? "").trim());
        return { nimi, maara, yksikko };
      })
      .filter((a) => a.nimi);

  async function lataaReseptit() {
    loading = true;
    error = "";
    try {
      const haku = ainesosaHaku.trim();

      let kysely = "";
      if (haku.length > 0) {
        kysely = `?ainesosat=${encodeURIComponent(haku)}`;
      }

      const res = await fetch(`${API}/api/recipes${kysely}`);
      if (!res.ok) throw new Error(`Haku epäonnistui (${res.status})`);
      reseptit = await res.json();
    } catch (e) {
      error = e.message ?? "Virhe";
    } finally {
      loading = false;
    }
  }

onMount(() => {
    lataaReseptit();
});

  async function lisaaResepti() {
    error = "";
    try {
      const body = {
        otsikko,
        kuvaus,
        ohjeet,
        ainesosat: parseAinesosat(ainesosatText),
      };

      const res = await fetch(`${API}/api/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const robleemaviesti = await res.text();
        throw new Error(
          `Lisäys epäonnistui (${res.status}): ${robleemaviesti}`
        );
      }

      otsikko = "";
      kuvaus = "";
      ohjeet = "";
      ainesosatText = "";

      await lataaReseptit();
    } catch (e) {
      error = e.message ?? "Virhe";
    }
  }

  async function poistaResepti(id) {
    if (!confirm("Poistetaanko resepti varmasti?")) return;
    error = "";
    try {
      const res = await fetch(`${API}/api/recipes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Poisto epäonnistui (${res.status})`);
      await lataaReseptit();
    } catch (e) {
      error = e.message ?? "Virhe";
    }
  }

  let muokattavaId = null;

  // edit-kentät
  let editOtsikko = "";
  let editKuvaus = "";
  let editOhjeet = "";
  let editAinesosatText = "";

  function ainesosatObjToText(ainesosat) {
    // Muuttaa [{nimi, maara, yksikko}] -> "nimi;maara;yksikko\n..."
    return (ainesosat || [])
      .map((a) => `${a.nimi ?? ""};${a.maara ?? ""};${a.yksikko ?? ""}`)
      .join("\n");
  }

  function aloitaMuokkaus(r) {
    if (muokattavaId === r._id) {
      peruMuokkaus();
      return;
    }
    muokattavaId = r._id;
    editOtsikko = r.otsikko ?? "";
    editKuvaus = r.kuvaus ?? "";
    editOhjeet = r.ohjeet ?? "";
    editAinesosatText = ainesosatObjToText(r.ainesosat);
  }

  function peruMuokkaus() {
    muokattavaId = null;
    editOtsikko = "";
    editKuvaus = "";
    editOhjeet = "";
    editAinesosatText = "";
  }

  async function tallennaMuokkaus() {
    error = "";
    try {
      const body = {
        otsikko: editOtsikko,
        kuvaus: editKuvaus,
        ohjeet: editOhjeet,
        ainesosat: parseAinesosat(editAinesosatText),
      };

      const res = await fetch(`${API}/api/recipes/${muokattavaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Muokkaus epäonnistui (${res.status}): ${msg}`);
      }

      peruMuokkaus();
      await lataaReseptit();
    } catch (e) {
      error = e.message ?? "Virhe";
    }
  }

  let aukiId = null;

  function toggleAuki(id) {
    if (aukiId === id) {
      // Jos klikattiin jo auki olevaa reseptiä -> suljetaan se
      aukiId = null;
    } else {
      // Muuten avataan tämä resepti (ja samalla “vaihdetaan” auki olevaa)
      aukiId = id;
    }
  }

  let kommenttiDraft = {}; // { [id]: "teksti" }
  let arvioDraft = {}; // { [id]: 1..5 }

  async function lisaaKommentti(id) {
    error = "";
    try {
      const teksti = (kommenttiDraft[id] ?? "").trim();
      if (!teksti) return;

      const res = await fetch(`${API}/api/recipes/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teksti }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Kommentti epäonnistui (${res.status}): ${msg}`);
      }

      kommenttiDraft = { ...kommenttiDraft, [id]: "" };
      await lataaReseptit();
    } catch (e) {
      error = e.message ?? "Virhe";
    }
  }

  async function lisaaArvio(id) {
    error = "";
    try {
      const arvo = Number(arvioDraft[id] ?? 0);
      if (!arvo) return;

      const res = await fetch(`${API}/api/recipes/${id}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arvo }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Arvio epäonnistui (${res.status}): ${msg}`);
      }

      arvioDraft = { ...arvioDraft, [id]: 0 };
      await lataaReseptit();
    } catch (e) {
      error = e.message ?? "Virhe";
    }
  }

</script>

<section class="grid">
  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="card">
    <h2>Hae resepti ainesosilla</h2>
    <div class="row">
      <input placeholder="esim. kana,sipuli" bind:value={ainesosaHaku} />
      <button
        class="btn btnPrimary"
        type="button"
        on:click={lataaReseptit}
        disabled={loading}
      >
        {loading ? "Haetaan..." : "Hae"}
      </button>
    </div>
  </div>

  <div class="card">
    <h2>Lisää resepti</h2>

    <!-- Formi: käytetään submit-eventtiä ja estetään reload -->
    <!--      |preventDefault -> Tämä on Svelten event modifier. 
    Se tekee automaattisesti event.preventDefault() ennen kuin kutsuu sun funktiota, 
    jolloin sivu ei lataa itseään uudelleen eikä yritä lähettää formia “perinteisesti”. -->
    <form on:submit|preventDefault={lisaaResepti}>
      <input placeholder="Reseptin nimi" bind:value={otsikko} />
      <input placeholder="Kuvaus (valinnainen)" bind:value={kuvaus} />
      <textarea rows="5" placeholder="Reseptin ohjeet" bind:value={ohjeet}
      ></textarea>

      <textarea
        rows="6"
        placeholder={"Ainesosat riveittäin: nimi;maara;yksikko\nEsim:\nKana;400;g\nSipuli;1;kpl"}
        bind:value={ainesosatText}
      ></textarea>

      <button
        class="btn btnPrimary"
        type="submit"
        disabled={!otsikko || !ohjeet}
      >
        Lisää resepti
      </button>
    </form>
  </div>

  <div class="card">
    <h2>Reseptilista ({reseptit.length})</h2>

    {#if loading}
      <p>Ladataan...</p>
    {:else if reseptit.length === 0}
      <p>Ei reseptejä vielä.</p>
    {:else}
      <ul class="list">
        {#each reseptit as r (r._id)}
          <li class="item">
            <!-- Otsikko + arvio -->
            <div class="topRow">
              <div class="title">{r.otsikko}</div>
              <div class="rating">
                Tähdet {r.arvioKeskiarvo ? r.arvioKeskiarvo.toFixed(1) : "0.0"} /
                5 ({r.arvioMaara ?? 0})
              </div>
            </div>

            <!-- Kuvaus -->
            {#if r.kuvaus}
              <div class="desc">{r.kuvaus}</div>
            {/if}

            <!-- Napit -->
            <div class="row actions">
              <button
                class="btn btnPrimary"
                type="button"
                on:click={() => toggleAuki(r._id)}
              >
                {aukiId === r._id ? "Piilota" : "Näytä"}
              </button>

              <button
                class="btn btnSecondary"
                type="button"
                on:click={() => aloitaMuokkaus(r)}
                disabled={loading}
              >
                Muokkaa
              </button>

              <button
                class="btn btnDanger"
                type="button"
                on:click={() => poistaResepti(r._id)}
                disabled={loading}
              >
                Poista
              </button>
            </div>

            <!-- Näytä -->
            {#if aukiId === r._id}
              <div class="details">
                <!-- Ainesosat -->
                <div class="detailsSection">
                  <div class="detailsTitle">Ainesosat</div>
                  <div class="ingredients">
                    {r.ainesosat?.length
                      ? r.ainesosat.map((a) => a.nimi).join(", ")
                      : "-"}
                  </div>
                </div>

                <!-- Ohjeet -->
                {#if r.ohjeet}
                  <div class="detailsSection">
                    <div class="detailsTitle">Ohjeet</div>
                    <div class="instructions">{r.ohjeet}</div>
                  </div>
                {/if}

                <!-- Kommentit -->
                <div class="detailsSection commentsSection">
                  <div class="detailsTitle">Kommentit</div>

                  {#if r.kommentit?.length}
                    <ul class="comments">
                      {#each r.kommentit as k}
                        <li class="comment">{k.teksti}</li>
                      {/each}
                    </ul>
                  {:else}
                    <div class="meta">Ei kommentteja vielä.</div>
                  {/if}
                </div>

                <!-- Lisää arvio / kommentti (aina alimmaisena) -->
                <div class="detailsSection addSection">
                  <div class="detailsTitle">Lisää arvio / kommentti</div>

                  <div class="row">
                    <select bind:value={arvioDraft[r._id]}>
                      <option value="0">Valitse arvio</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>

                    <button
                      class="btn btnPrimary"
                      type="button"
                      on:click={() => lisaaArvio(r._id)}>Anna arvio</button
                    >
                  </div>

                  <div class="row" style="margin-top: 8px;">
                    <input
                      class="commentInput"
                      placeholder="Kirjoita kommentti..."
                      bind:value={kommenttiDraft[r._id]}
                    />
                    <button
                      class="btn btnPrimary"
                      type="button"
                      on:click={() => lisaaKommentti(r._id)}
                      >Lisää kommentti</button
                    >
                  </div>
                </div>
              </div>
            {/if}

            <!-- Muokkauslomake -->
            {#if muokattavaId === r._id}
              <form class="edit" on:submit|preventDefault={tallennaMuokkaus}>
                <input placeholder="Otsikko" bind:value={editOtsikko} />
                <input placeholder="Kuvaus" bind:value={editKuvaus} />
                <textarea rows="4" placeholder="Ohjeet" bind:value={editOhjeet}
                ></textarea>
                <textarea
                  rows="5"
                  placeholder="Ainesosat: nimi;maara;yksikko"
                  bind:value={editAinesosatText}
                ></textarea>

                <div class="row">
                  <button class="btn btnPrimary" type="submit">Tallenna</button>
                  <button
                    class="btn btnDanger"
                    type="button"
                    on:click={peruMuokkaus}>Peru</button
                  >
                </div>
              </form>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  /* Layout */
  .grid {
    display: grid;
    gap: 16px;
  }

  .card {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px;
    background: white;
  }

  /* Yleiset rivit */
  .row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Form-elementit */
  input,
  textarea,
  select {
    width: 100%;
    padding: 10px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    box-sizing: border-box;
    background: white;
  }

  textarea {
    resize: vertical;
  }

  /* Nappulat */
  .btn {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 0.02s ease,
      opacity 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .btn:hover {
    opacity: 0.95;
  }

  .btn:active {
    transform: translateY(1px);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Primary = päätoiminto */
  .btnPrimary {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
  }

  .btnPrimary:hover {
    background: var(--primary-2);
    border-color: var(--primary-2);
  }

  /* Secondary = neutraali */
  .btnSecondary {
    background: rgb(28, 241, 0);
    border-color: var(--border);
    color: var(--text);
  }

  .btnSecondary:hover {
    background: #f1f5f9;
  }

  /* Danger = poisto */
  .btnDanger {
    background: var(--danger);
    border-color: var(--danger);
    color: white;
  }

  .btnDanger:hover {
    filter: brightness(0.95);
  }

  /* Virheet */
  .error {
    color: #b00020;
    font-weight: 600;
  }

  /* Reseptilista */
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 12px;
  }

  .item {
    border: 1px solid #eef2f7;
    border-radius: 12px;
    padding: 14px;
    background: #fbfdff;
  }

  /* Otsikko + arvio */
  .topRow {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 800;
    line-height: 1.2;
    color: #0f172a;
  }

  .rating {
    font-size: 0.95rem;
    color: #475569;
    white-space: nowrap;
  }

  /* Kuvaus isommaksi ja selkeä */
  .desc {
    margin-top: 6px;
    font-size: 1.05rem;
    color: #334155;
  }

  /* Toissijainen teksti */
  .meta {
    margin-top: 6px;
    font-size: 0.95rem;
    color: #475569;
  }

  /* Details */
  .details {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: grid;
    gap: 12px;
  }

  .detailsSection {
    display: grid;
    gap: 6px;
  }

  .detailsTitle {
    font-weight: 800;
    color: #0f172a;
  }

  .ingredients {
    color: #475569;
  }

  .instructions {
    white-space: pre-wrap;
    color: #0f172a;
    line-height: 1.4;
  }

  /* Kommentit: italic + viiva marker */
  .comments {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }

  .comment {
    font-style: italic; /* italics */
    color: #334155;
    position: relative;
    padding-left: 14px;
  }

  .comment::before {
    content: "-";
    position: absolute;
    left: 0;
    color: #64748b;
  }

  /* Lisää arvio/kommentti - selkeästi erilleen */
  .addSection {
    border-top: 1px dashed #cbd5e1;
    padding-top: 12px;
    background: #f8fafc;
    border-radius: 12px;
    padding: 12px;
  }

  .commentInput {
    flex: 1;
    min-width: 220px;
  }

  /* Muokkausformi */
  .edit {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: grid;
    gap: 10px;
    background: #ffffff;
  }

  .row input {
    flex: 1;
    min-width: 220px;
  }
</style>
