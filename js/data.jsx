// Incubator data — the small set of exhibitions and artists the prototype runs on.
// Drawn from the live site and the gallery's 2026 brief.

const EXHIBITIONS = [
  {
    id: "66-charlie-gosling-good-luck-with-me-here",
    artistId: "charlie-gosling",
    artist: "Charlie Gosling",
    title: "Good Luck With Me Here",
    dates: "29 April – 24 May 2026",
    startISO: "2026-04-29",
    endISO: "2026-05-24",
    current: true,
    hero: "warm-1",
    palette: "sap",
    pressRelease: [
      "For his second solo exhibition at Incubator, Charlie Gosling returns with a body of work that has been years in the making. Where his 2021 debut introduced a painter closely observing near-strangers, *Good Luck with Me Here* marks a deepening of that impulse: portraits of friends, partners and loved ones, people who populate Gosling's daily life and whose faces have become inseparable from his understanding of painting itself.",
      "Gosling works predominantly from photographs. His subjects are placed against the studio wall and meet the camera head-on with the frank directness of a passport portrait. Working between a studio in Holborn and a barn in Suffolk, he has moved away from the loaded, accumulated surfaces of his earlier work toward a method of application and subtraction. Many of the paintings are made on found wooden boards from the Suffolk barn: paint laid down and scraped back, laid down and scraped back again, producing a thinned, almost spectral surface in which figures almost dissolve into their environments.",
      "Two larger paintings, *Eric* and *Huddie*, are loosely handled and almost impressionistic, their figures lending themselves the quality of having arrived from another century. In the tradition of Freud, de Kooning, Auerbach and Cézanne, Gosling finds in the faces around him an inexhaustible subject that accumulates into something larger, a portrait of London now."
    ],
    installation: ["a","b","c","d","e","f"],
  },
  {
    id: "65-xiaochi-dong-leaves-leave",
    artistId: "xiaochi-dong",
    artist: "Xiaochi Dong",
    title: "Leaves Leave",
    dates: "1 – 25 April 2026",
    startISO: "2026-04-01",
    endISO: "2026-04-25",
    current: false,
    hero: "cool-1",
    palette: "sky",
    pressRelease: [
      "Incubator is pleased to present new work by Xiaochi Dong that draws from Eastern and Western visual languages in equal measure, finding in their convergence a space to think carefully about how a painted surface holds time. The exhibition takes its title from a phrase Dong has been circling for years, a phrase whose grammar refuses to settle.",
      "The works on view are small, slow, and intricately built. Dong applies and removes pigment in layers that allow the underpainting to keep speaking — what looks like emptiness is rarely empty.",
    ],
    installation: ["a","b","c","d","e","f"],
  },
  {
    id: "64-katherine-qiyu-su-mountains-and-rivers-will-meet-again",
    artistId: "katherine-qiyu-su",
    artist: "Katherine Qiyu Su",
    title: "Mountains and Rivers Will Meet Again",
    dates: "4 – 29 March 2026",
    startISO: "2026-03-04",
    endISO: "2026-03-29",
    current: false,
    hero: "warm-2",
    palette: "vermilion",
    pressRelease: [
      "Katherine Qiyu Su (b. 1999, Beijing) is a London-based artist whose work navigates the shifting terrain between figuration and abstraction through explorations of memory, perception, and emotional residue.",
      "The paintings gather in a tonal range as narrow as a held breath; figures emerge from grounds that refuse to settle, the eye returning to the same rectangle of canvas with different findings each time.",
    ],
    installation: ["a","b","c","d","e","f"],
  },
  {
    id: "63-harry-grundy-full-pelt",
    artistId: "harry-grundy",
    artist: "Harry Grundy",
    title: "FULL PELT",
    dates: "5 February – 1 March 2026",
    startISO: "2026-02-05",
    endISO: "2026-03-01",
    current: false,
    hero: "warm-3",
    palette: "persimmon",
    pressRelease: [
      "Harry Grundy's first solo presentation at Incubator gathers paintings made over the past eighteen months — works that test how fast a picture can be made without its meaning thinning out.",
    ],
    installation: ["a","b","c","d","e","f"],
  },
  {
    id: "62-notes-from-the-studio",
    artistId: null, // group show
    artist: "Group show",
    title: "Notes from the Studio",
    dates: "11 December 2025 – 31 January 2026",
    startISO: "2025-12-11",
    endISO: "2026-01-31",
    current: false,
    hero: "cool-2",
    isGroup: true,
    palette: "sunflower",
    pressRelease: [
      "*Notes from the Studio* is an exhibition bringing together artists of different generations and disciplines, each sharing an item fixed to their studio wall — a note, sketch, postcard, colour swatch, or photograph. The result is an unstable archive of the moments before a work begins.",
    ],
    installation: ["a","b","c","d","e","f"],
  },
  {
    id: "61-charlie-gosling-i",
    artistId: "charlie-gosling",
    artist: "Charlie Gosling",
    title: "Charlie Gosling I",
    dates: "3 – 28 November 2021",
    startISO: "2021-11-03",
    endISO: "2021-11-28",
    current: false,
    hero: "warm-4",
    palette: "tobacco",
    pressRelease: [
      "Charlie Gosling's first exhibition at Incubator introduced a painter closely observing near-strangers — Uber drivers, sitters glimpsed in transit, faces encountered for an hour at a time.",
    ],
    installation: ["a","b","c","d","e","f"],
  },
];

const ARTISTS = [
  {
    id: "charlie-gosling",
    name: "Charlie Gosling",
    bio: [
      "Charlie Gosling (b. 1995, London) is a painter whose work moves between portraiture and landscape, drawing on photography, found wood supports, and the long tradition of London-based painters from Freud to Auerbach. He studied at the Royal Drawing School and teaches periodically at the National Portrait Gallery, in schools, and in homeless shelters across the city.",
      "He has had two solo exhibitions at Incubator: *Charlie Gosling I* in 2021 and *Good Luck With Me Here* in 2026.",
    ],
  },
  {
    id: "xiaochi-dong",
    name: "Xiaochi Dong",
    bio: [
      "Xiaochi Dong (b. 1997, Tianjin) lives and works in London. Her paintings move slowly between Eastern and Western visual languages, often in the space of a single panel.",
    ],
  },
  {
    id: "katherine-qiyu-su",
    name: "Katherine Qiyu Su",
    bio: [
      "Katherine Qiyu Su (b. 1999, Beijing) is a London-based artist whose work navigates the shifting terrain between figuration and abstraction through explorations of memory, perception, and emotional residue. She received her MFA from the Slade in 2024.",
    ],
  },
  {
    id: "harry-grundy",
    name: "Harry Grundy",
    bio: [
      "Harry Grundy (b. 1993, Manchester) is a painter based in London. His work is made quickly, often in single sittings, and explores how fast a picture can be made without losing its weight.",
    ],
  },
];

const PRESS = [
  { year: 2026, items: [
    { date: "May 2026",     pub: "Apollo",         title: "Charlie Gosling at Incubator", href: "#" },
    { date: "April 2026",   pub: "Frieze",         title: "Xiaochi Dong's slow surfaces", href: "#" },
    { date: "March 2026",   pub: "The Burlington", title: "Katherine Qiyu Su at Incubator", href: "#" },
  ]},
  { year: 2025, items: [
    { date: "December 2025", pub: "Art Review",   title: "Notes from the Studio", href: "#" },
    { date: "October 2025",  pub: "The Guardian", title: "London's small galleries, big year", href: "#" },
  ]},
  { year: 2024, items: [
    { date: "September 2024", pub: "Wallpaper*",  title: "Inside Incubator, Marylebone", href: "#" },
  ]},
  { year: 2023, items: [
    { date: "May 2023", pub: "ArtForum", title: "On Incubator's first five years", href: "#" },
  ]},
  { year: 2022, items: [
    { date: "April 2022", pub: "Apollo",  title: "Charlie Gosling's debut", href: "#" },
  ]},
  { year: 2021, items: [
    { date: "November 2021", pub: "FT Weekend", title: "A new gallery on Chiltern Street", href: "#" },
  ]},
];

// Extra past shows so the exhibitions list reads as a real archive (titles only).
const EXHIBITION_ARCHIVE = [
  { id: "60-seraphina-mutscheller-woodwind", artist: "Seraphina Mutscheller", title: "Woodwind",                       dates: "8 October – 2 November 2025",  palette: "tobacco",   hero: "warm-2" },
  { id: "59-maya-gurung-russell-ready",      artist: "Maya Gurung-Russell",  title: "I Want To Be Ready",              dates: "10 September – 5 October 2025", palette: "sky",       hero: "cool-1" },
  { id: "58-the-yellow-wallpaper",           artist: "Group show",           title: "The Yellow Wallpaper", isGroup: true, dates: "3 July – 3 August 2025",  palette: "persimmon", hero: "warm-3" },
  { id: "57-lorena-levi-cold-hard-plastic",  artist: "Lorena Levi",          title: "Cold Hard Plastic",               dates: "6 – 30 November 2025",        palette: "vermilion", hero: "warm-1" },
  { id: "56-kasia-wozniak-stillpoint",       artist: "Kasia Wozniak",        title: "Stillpoint",                      dates: "5 – 28 June 2025",            palette: "sap",       hero: "cool-2" },
  { id: "55-losel-yauch-until-next-time",    artist: "Losel Yauch",          title: "Until Next Time",                 dates: "1 – 24 May 2025",             palette: "sunflower", hero: "warm-4" },
  { id: "54-atticus-wakefield-allegory",     artist: "Atticus Wakefield",    title: "After the Allegory",              dates: "27 March – 26 April 2025",    palette: "tobacco",   hero: "warm-2" },
  { id: "53-frank-kent-flowers",             artist: "Frank Kent",           title: "Flowers",                         dates: "20 February – 22 March 2025", palette: "vermilion", hero: "warm-3" },
  { id: "52-anne-carney-raines",             artist: "Anne Carney Raines",   title: "Reaching Outward",                dates: "16 January – 15 February 2025", palette: "sky",     hero: "cool-1" },
  { id: "51-leonard-iheagwam-saints",        artist: "Leonard \u201CSoldier\u201D Iheagwam", title: "When the Saints Go Marching", dates: "18 – 28 April 2024", palette: "persimmon", hero: "warm-1" },
];

Object.assign(window, { EXHIBITIONS, ARTISTS, PRESS, EXHIBITION_ARCHIVE });
