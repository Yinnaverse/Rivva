// Placeholder content until Supabase is wired in (phase 3+).
export type Movie = {
  id: string;
  title: string;
  genre: string;
  blurb: string;
  rating: number;
  duration: string;
  hue: number; // drives the placeholder poster gradient
};


export const trending: Movie[] = [
  { id: 'm1', title: 'Night Signal', genre: 'Sci-Fi', blurb: 'A radio operator picks up a broadcast from a town that no longer exists.', rating: 4.8, duration: '2hr 32min', hue: 350 },
  { id: 'm2', title: 'The Long Harmattan', genre: 'Drama', blurb: 'Two siblings drive across the country to settle their father’s last wish.', rating: 4.6, duration: '1hr 54min', hue: 28 },
];

export const catalogue: Movie[] = [
  ...trending,
  { id: 'm3', title: 'Paper Lanterns', genre: 'Romance', blurb: 'A lantern maker and a night-shift baker keep missing each other across one long festival week.', rating: 4.4, duration: '1hr 48min', hue: 40 },
  { id: 'm4', title: 'Hollow Creek', genre: 'Horror', blurb: 'Six friends rent a lake house that has already been rented for years.', rating: 4.2, duration: '1hr 41min', hue: 150 },
  { id: 'm5', title: 'Last Train to Ikeja', genre: 'Thriller', blurb: 'A courier has one ride across the city to deliver a package she is not meant to open.', rating: 4.5, duration: '2hr 05min', hue: 215 },
];
