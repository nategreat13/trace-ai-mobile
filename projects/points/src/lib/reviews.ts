/**
 * Reviews for the paywall's second page, from real Trace users who agreed
 * to be quoted (Trevor collected them, Oct 2026). Quoted exactly as written;
 * first name plus last initial only. Only real reviews go here. Trevor
 * chose the 5-star ones to show, so the page makes no claim about an
 * average or the total count (the full set of 15 averaged 4.7).
 *
 * `sample` marks a made-up stand-in for checking layouts: it renders only on
 * a local dev server or a private preview built with
 * NEXT_PUBLIC_SHOW_SAMPLE_REVIEWS=1, never on the live site.
 */
export interface Review {
  name: string;
  stars: 5;
  title: string;
  text: string;
  sample?: boolean;
}

export const REVIEWS: Review[] = [
  { name: "Megan L.", stars: 5, title: "Had no idea I could go to these places", text: "I've had Chase points sitting in my account for like 3 years. I always assumed I didn't have enough to do anything with them. Turns out I was wrong lol. Really cool seeing actual trips instead of just a number in my account." },
  { name: "Ashley R.", stars: 5, title: "love this", text: "Honestly just fun to swipe through all the places I could go. Didn't expect to spend this much time on here haha" },
  { name: "Daniel M.", stars: 5, title: "Finally figured out my miles", text: "I travel a decent amount for work and have accumulated a bunch of airline miles over the years. Never really knew the best way to use them. What I like about Trace is that I don't need to know where I want to go first. It just gives me options based on what I have." },
  { name: "Jason T.", stars: 5, title: "Why hasn't someone made this before?", text: "Seriously. I've been looking for something like this forever. Just tell me where I can fly with my points without making me search 10 different airline websites." },
  { name: "Priya S.", stars: 5, title: "The cash prices are eye opening", text: "Seeing that a flight would cost me $1,200 in cash but could potentially be booked with points I already have is wild. Makes me regret all the points I've cashed out over the years." },
  { name: "Emily W.", stars: 5, title: "Planning our honeymoon!!", text: "My fiancé and I have been saving up points for our honeymoon and had NO clue how many we'd actually need. This is making the planning process a lot easier. Love being able to see options for two people instead of just one." },
  { name: "Matt C.", stars: 5, title: "So simple", text: "Added my points. Picked my airport. Started looking at trips. That's pretty much it. Exactly what I wanted." },
  { name: "Brandon H.", stars: 5, title: "The almost there trips are my favorite", text: "I like seeing the trips I can book now, but honestly the ones I'm close to are even better. Gives me an actual reason to keep saving points. Before this I was just earning them with no real goal." },
  { name: "Olivia D.", stars: 5, title: "Didn't expect to like this so much", text: "Downloaded it mostly out of curiosity. I only have one travel credit card so I wasn't expecting much, but there were more options than I thought. The whole swipe thing is surprisingly addicting." },
  { name: "Nicole A.", stars: 5, title: "My points might finally get used", text: "Not gonna lie, I usually just let my points pile up because trying to book flights with them seems like a whole project. Now I can actually see what they're worth and where we could go. Already saved a few trips for next year." },
];

/** The reviews this build can show: real ones, plus samples on a local dev server or a flagged preview. */
export const shownReviews = () =>
  REVIEWS.filter((r) => !r.sample || process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_SAMPLE_REVIEWS === "1");
