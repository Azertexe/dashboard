// Photos de fond par thème ET par format (cf. public/bg/<thème>/<format>/) —
// préfixées par BASE_URL au moment de l'affichage, cf. BackgroundSlideshow.jsx.
// 'desktop' sert PC et Mac (photos paysage), 'iphone' sert la disposition
// iPhone (photos portrait, cf. layoutMode dans App.jsx — même signal déjà
// utilisé pour le bug de survol iOS de la jauge d'examen). Un couple
// thème/format vide retombe simplement sur la texture rayée existante :
// rien de spécial à faire tant qu'aucune photo n'y est déposée, juste
// compléter le tableau correspondant.
export const BACKGROUND_PHOTOS = {
  glacier: {
    desktop: [
      'bg/glacier/desktop/01.webp',
      'bg/glacier/desktop/02.webp',
      'bg/glacier/desktop/03.webp',
      'bg/glacier/desktop/04.webp',
    ],
    iphone: ['bg/glacier/iphone/01.webp', 'bg/glacier/iphone/02.webp'],
  },
  volcanique: {
    desktop: [
      'bg/volcanique/desktop/01.webp',
      'bg/volcanique/desktop/02.webp',
      'bg/volcanique/desktop/03.webp',
      'bg/volcanique/desktop/04.webp',
    ],
    iphone: [],
  },
  detente: { desktop: [], iphone: [] },
}

/** `layoutMode` ('pc'|'mac'|'iphone') → le format assorti ('desktop' pour
 * PC/Mac, 'iphone' pour iPhone). */
export function backgroundPhotosFor(theme, layoutMode) {
  const format = layoutMode === 'iphone' ? 'iphone' : 'desktop'
  return BACKGROUND_PHOTOS[theme]?.[format] ?? []
}
