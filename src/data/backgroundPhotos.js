// Photos de fond par thème (chemins publics relatifs à public/bg/<thème>/,
// préfixés par BASE_URL au moment de l'affichage — cf. BackgroundSlideshow.jsx).
// Un thème sans photo ici retombe simplement sur la texture rayée existante
// (body, global.css) : rien de spécial à faire pour Volcanique/Détente tant
// qu'aucune photo n'y est déposée, juste compléter ce tableau.
export const BACKGROUND_PHOTOS = {
  glacier: ['bg/glacier/01.webp', 'bg/glacier/02.webp', 'bg/glacier/03.webp', 'bg/glacier/04.webp'],
  volcanique: [],
  detente: [],
}
