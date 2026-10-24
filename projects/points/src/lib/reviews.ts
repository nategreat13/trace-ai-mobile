/**
 * Reviews for the paywall's second page. Only real ones go live: each needs
 * the person's permission, and first name plus last initial is plenty.
 *
 * The `sample` entries are made-up stand-ins for checking the layout. They
 * render only on a local dev server (never in a built site), and with no
 * real reviews the paywall skips the reviews page entirely. Replace them as
 * real reviews come in, and delete them once there are a few.
 */
export interface Review {
  name: string;
  text: string;
  /** What they booked, shown as a small tag: "Tokyo in business". */
  trip?: string;
  sample?: boolean;
}

export const REVIEWS: Review[] = [
  { sample: true, name: "Sample A.", trip: "Maui", text: "Had 60k Chase points sitting there for two years. Trace showed me Maui round trip for 25k. Booked it the same night." },
  { sample: true, name: "Sample B.", trip: "Paris in business", text: "I didn't know my Amex points could get me lie-flat to Paris. The steps were dead simple." },
  { sample: true, name: "Sample C.", trip: "Cancún", text: "Took a minute to see what my points could do. Way easier than reading blogs for hours." },
  { sample: true, name: "Sample D.", trip: "Tokyo", text: "The seat alert hit my phone and I grabbed two seats before they were gone." },
  { sample: true, name: "Sample E.", trip: "New York", text: "Used points I forgot I had for a weekend in NYC. Zero cash for the flights." },
  { sample: true, name: "Sample F.", trip: "Costa Rica", text: "The team double-checked the seats for me and walked me through the transfer. Super helpful." },
  { sample: true, name: "Sample G.", trip: "London", text: "Finally understand transfer partners. Trace just shows you the trip and how to book it." },
  { sample: true, name: "Sample H.", trip: "Honolulu", text: "Booked Hawaii for my parents with points. They think I'm a genius now." },
  { sample: true, name: "Sample I.", trip: "Rome", text: "Caught a transfer bonus I would have totally missed. Saved me 20k points." },
  { sample: true, name: "Sample J.", trip: "Los Cabos", text: "Simple, fast, and it actually works. Paid for itself on the first trip." },
];

/** The reviews this build can show: real ones, plus samples on a local dev server only. */
export const shownReviews = () => REVIEWS.filter((r) => !r.sample || process.env.NODE_ENV === "development");
