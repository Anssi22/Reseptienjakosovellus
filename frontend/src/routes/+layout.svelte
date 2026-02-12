<!-- title on <script>-osan alla, koska kaikki “muuttujat ja logiikka” 
määritellään Svelte-komponentissa script-blokissa, ja niitä käytetään sitten markupissa aaltosulkeilla {}. -->

<script>
	import "../app.css";

  const title = "Reseptien jakosivusto";
</script>

<!-- <svelte:head> ... </svelte:head> lisää sisältöä HTML-sivun document.head-osaan (esim. <title>, <meta>). 
Svelten dokumentaatio sanoo, että tällä elementillä voi “insert elements into document.head” -->

<svelte:head>
  <title>{title}</title>
</svelte:head>

<header class="header">
  <div class="container">
    <h1 class="brand">{title}</h1>
  </div>
</header>

<!-- slot /> layoutissa tarkoittaa “tähän kohtaan renderöidään tämän layoutin sisällä olevien sivujen sisältö”. 
Slotit ovat mekanismi, jolla parent-komponentti (tässä +layout.svelte) näyttää lapsen (tässä +page.svelte) sisällön halutussa kohdassa. -->
​
<main class="container">
  <slot />
</main>

<style>
  .header {
    border-bottom: 1px solid #e5e7eb;
    background: white;
  }
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 16px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .brand {
    font-weight: 900;
    text-decoration: none;
    color: inherit;
  }

</style>
