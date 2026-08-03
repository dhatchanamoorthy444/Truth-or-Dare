/**
 * Challenge library.
 *
 * Prompts are assembled from per-category templates crossed with topic banks,
 * which keeps the source readable while producing 1000+ unique truths and
 * 1000+ unique dares. `{p}` is replaced with a player name at render time.
 */

export type ChallengeType = "truth" | "dare";
export type Difficulty = "easy" | "medium" | "hard" | "crazy";

export const CATEGORIES = [
  "friends",
  "couples",
  "family",
  "kids",
  "party",
  "extreme",
  "romantic",
  "funny",
  "adult",
  "custom",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<
  Category,
  { label: string; emoji: string; blurb: string; adult?: boolean }
> = {
  friends: { label: "Friends", emoji: "🤝", blurb: "Classic squad chaos" },
  couples: { label: "Couples", emoji: "💞", blurb: "Just the two of you" },
  family: { label: "Family", emoji: "🏡", blurb: "Living-room safe" },
  kids: { label: "Kids", emoji: "🧸", blurb: "Silly and wholesome" },
  party: { label: "Party", emoji: "🎉", blurb: "Loud group energy" },
  extreme: { label: "Extreme", emoji: "🔥", blurb: "No backing out" },
  romantic: { label: "Romantic", emoji: "🌹", blurb: "Soft and flirty" },
  funny: { label: "Funny", emoji: "😂", blurb: "Pure comedy" },
  adult: { label: "Adult 18+", emoji: "🔞", blurb: "Spicy grown-ups", adult: true },
  custom: { label: "Custom", emoji: "✨", blurb: "Your own prompts" },
};

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "crazy"];

export interface Challenge {
  id: string;
  text: string;
  type: ChallengeType;
  category: Category;
  difficulty: Difficulty;
}

type Bank = { truth: string[]; dare: string[]; topics: string[] };

const BANKS: Record<Exclude<Category, "custom">, Bank> = {
  friends: {
    topics: [
      "your first day of school",
      "your worst haircut",
      "your group chat",
      "your last road trip",
      "your phone gallery",
      "your oldest friendship",
      "your biggest lie",
      "your weirdest habit",
      "your dream job",
      "your worst purchase",
      "your celebrity crush",
      "your karaoke song",
    ],
    truth: [
      "What is the most embarrassing thing you've never told anyone about {x}?",
      "If you had to describe {x} in one brutally honest sentence, what would it be?",
      "What's a secret opinion you have about {x}?",
      "Which person in this room reminds you of {x} and why?",
      "What's the biggest lie you've ever told about {x}?",
      "How would your best friend describe {x} about you?",
      "What would you change about {x} if nobody would judge you?",
      "Rate {x} out of 10 and defend the score.",
      "What's the story behind {x} that you always skip?",
      "Who here would handle {x} the worst, and why?",
    ],
    dare: [
      "Act out {x} with zero words for 30 seconds.",
      "Text a friend a dramatic update about {x} right now.",
      "Do your best impression of someone reacting to {x}.",
      "Make up a 15-second theme song about {x}.",
      "Describe {x} using only sound effects.",
      "Take a selfie that captures {x} and show the group.",
      "Give a passionate 20-second TED talk on {x}.",
      "Let the player on your left narrate {x} while you act it out.",
      "Draw {x} in 20 seconds and make everyone guess.",
      "Say the alphabet backwards while thinking about {x}.",
    ],
  },
  couples: {
    topics: [
      "your first date",
      "the first text you sent each other",
      "your last argument",
      "your favorite memory together",
      "meeting each other's family",
      "your future house",
      "your worst gift",
      "your love language",
      "a habit you secretly find cute",
      "the moment you knew",
      "your dream trip together",
      "a promise you made",
    ],
    truth: [
      "What do you actually remember about {x}?",
      "What's something you never admitted about {x}?",
      "How did {x} change the way you see us?",
      "If you could redo {x}, what would you do differently?",
      "What's one feeling you hid during {x}?",
      "What did {x} teach you about me?",
      "Be honest: how do you rank {x} in our story?",
      "What's a small detail from {x} you still think about?",
      "Who handled {x} better and why?",
      "What would you tell past-you about {x}?",
    ],
    dare: [
      "Recreate {x} in a 20-second reenactment.",
      "Write a two-line poem about {x} and read it out loud.",
      "Send your partner a voice note about {x} right now.",
      "Give a compliment inspired by {x} while holding eye contact.",
      "Reenact {x} but as a soap-opera scene.",
      "Describe {x} in five words only.",
      "Slow dance for 30 seconds while remembering {x}.",
      "Draw {x} on your partner's palm and let them guess.",
      "Do your partner's exact reaction from {x}.",
      "Post a story-style photo caption about {x}.",
    ],
  },
  family: {
    topics: [
      "the last family trip",
      "a childhood chore",
      "a family recipe",
      "an old photo album",
      "the family group chat",
      "a holiday tradition",
      "an inside joke",
      "the loudest family member",
      "a favorite bedtime story",
      "a broken household item",
      "a family nickname",
      "the best home-cooked meal",
    ],
    truth: [
      "What's your honest memory of {x}?",
      "Who in this family is most responsible for {x}?",
      "What's something about {x} you never told your parents?",
      "How would you improve {x} for next year?",
      "What's the funniest thing that happened during {x}?",
      "Which family member would survive {x} the longest?",
      "What's one thing you'd keep forever from {x}?",
      "Who gets too much credit for {x}?",
      "What's your first ever memory of {x}?",
      "If {x} was a movie, what genre would it be?",
    ],
    dare: [
      "Impersonate a family member reacting to {x}.",
      "Retell {x} like a sports commentator.",
      "Make a 15-second ad for {x}.",
      "Draw {x} with your non-dominant hand.",
      "Reenact {x} in slow motion.",
      "Sing a jingle about {x}.",
      "Describe {x} using only emojis you say out loud.",
      "Do a dramatic reading of {x} in a movie-trailer voice.",
      "Act out {x} as a silent film.",
      "Give an award speech thanking everyone for {x}.",
    ],
  },
  kids: {
    topics: [
      "your favorite animal",
      "your superhero name",
      "your dream treehouse",
      "the best ice-cream flavor",
      "your favorite cartoon",
      "a monster under the bed",
      "your best drawing",
      "a magic power",
      "your favorite game",
      "the funniest joke you know",
      "a talking pet",
      "the coolest dinosaur",
    ],
    truth: [
      "What makes {x} the best thing ever?",
      "If {x} could talk, what would it say to you?",
      "What's the silliest thing about {x}?",
      "Would you trade your snacks for {x}? Why?",
      "What would you name {x}?",
      "How would you explain {x} to an alien?",
      "What's your favorite thing to do with {x}?",
      "If {x} came to school, what would happen?",
      "What color is {x} in your imagination?",
      "Who would you share {x} with first?",
    ],
    dare: [
      "Act like {x} for 20 seconds.",
      "Make the sound {x} would make.",
      "Do a happy dance about {x}.",
      "Draw {x} in 15 seconds.",
      "Tell a mini story about {x}.",
      "Hop on one foot while shouting about {x}.",
      "Make your funniest face inspired by {x}.",
      "Sing 'Happy Birthday' as if you were {x}.",
      "Walk across the room like {x}.",
      "Give a high-five to everyone and yell {x}.",
    ],
  },
  party: {
    topics: [
      "the dance floor",
      "your last night out",
      "the group photo",
      "the playlist",
      "the snack table",
      "the loudest guest",
      "the taxi ride home",
      "a party foul",
      "the best entrance",
      "an awkward introduction",
      "the after-party",
      "the karaoke machine",
    ],
    truth: [
      "What's your most chaotic memory of {x}?",
      "Who here owns {x} completely and why?",
      "What's the worst decision you've made because of {x}?",
      "Rate everyone here on {x} from best to worst.",
      "What's the truth about you and {x}?",
      "Who would you never trust with {x}?",
      "What's your secret strategy for {x}?",
      "What's the wildest thing you've seen at {x}?",
      "Which player would go viral because of {x}?",
      "What's your honest rating of {x} tonight?",
    ],
    dare: [
      "Own {x} with a 20-second freestyle dance.",
      "Start a chant about {x} and get everyone to join.",
      "Do a dramatic runway walk inspired by {x}.",
      "Give a toast dedicated to {x}.",
      "Freestyle rap for 15 seconds about {x}.",
      "Let the group choose your pose for a photo about {x}.",
      "Do 10 jumping jacks while shouting about {x}.",
      "Speak in an accent about {x} until your next turn.",
      "Reenact {x} with the person on your right.",
      "Post a poll about {x} to your story.",
    ],
  },
  extreme: {
    topics: [
      "your deepest fear",
      "your worst nightmare",
      "a rule you broke",
      "the coldest shower",
      "your biggest regret",
      "the darkest secret you'd share",
      "the scariest dare you refused",
      "your last screenshot",
      "a grudge you keep",
      "your search history",
      "a message you never sent",
      "the riskiest thing you've done",
    ],
    truth: [
      "No filter: tell the group about {x}.",
      "What's the part of {x} you'd never post online?",
      "If everyone here found out about {x}, what changes?",
      "What's the harshest truth about {x}?",
      "How far would you go to hide {x}?",
      "What's the one detail of {x} you're leaving out right now?",
      "Who here would judge you most for {x}?",
      "What's the consequence you're still living with from {x}?",
      "What's the boldest thing you'd do to fix {x}?",
      "Rank {x} against your other secrets.",
    ],
    dare: [
      "Hold a plank while confessing about {x}.",
      "Let the group ask three rapid questions about {x}.",
      "Record a 15-second voice note about {x} and play it.",
      "Do 20 squats and shout something true about {x}.",
      "Let the player on your left type a message about {x} (you approve before sending).",
      "Keep a straight face for 60 seconds while everyone teases you about {x}.",
      "Hold an ice cube while explaining {x}.",
      "Do your most dramatic scream about {x}.",
      "Stand on one leg for a minute talking about {x}.",
      "Let the group pick your next profile caption about {x}.",
    ],
  },
  romantic: {
    topics: [
      "a perfect evening",
      "a slow song",
      "the way they laugh",
      "handwritten letters",
      "a rainy walk",
      "morning coffee together",
      "a surprise gift",
      "holding hands",
      "a shared playlist",
      "sunset views",
      "your favorite photo of them",
      "a quiet moment",
    ],
    truth: [
      "What does {x} mean to you honestly?",
      "When did {x} last make your heart race?",
      "What's the softest thing about {x}?",
      "How would you recreate {x} perfectly?",
      "What memory of {x} would you keep forever?",
      "What do you feel but never say about {x}?",
      "How has {x} changed you?",
      "Who in your life understands {x} the way you do?",
      "What would you write in a letter about {x}?",
      "What's the most romantic version of {x} you can imagine?",
    ],
    dare: [
      "Give a 20-second speech about {x}.",
      "Write a one-line love note about {x} and read it out.",
      "Hum a song that reminds you of {x}.",
      "Describe {x} while holding eye contact for 20 seconds.",
      "Send someone a message about {x} right now.",
      "Recreate the feeling of {x} with a facial expression only.",
      "Slow-dance for 20 seconds imagining {x}.",
      "Whisper a compliment inspired by {x}.",
      "Name three things you love, all connected to {x}.",
      "Draw a tiny heart doodle about {x} and explain it.",
    ],
  },
  funny: {
    topics: [
      "your worst dance move",
      "a bad haircut",
      "an autocorrect fail",
      "your morning face",
      "a pet's attitude",
      "your gym form",
      "the worst movie you love",
      "an awkward wave",
      "your cooking skills",
      "a fake laugh",
      "your last typo",
      "a terrible pickup line",
    ],
    truth: [
      "What's the true story behind {x}?",
      "Who here is guiltiest of {x}?",
      "How bad is your {x} on a scale of 1 to 10?",
      "What's the most embarrassing version of {x} you've done?",
      "When did {x} last ruin your day?",
      "Would you rather lose your phone or explain {x} to a stranger?",
      "What's your excuse for {x}?",
      "Who would win a contest of {x} in this room?",
      "What nickname would you give {x}?",
      "What would your family say about {x}?",
    ],
    dare: [
      "Perform {x} at maximum drama.",
      "Do a stand-up bit about {x} for 20 seconds.",
      "Make the ugliest face you can about {x}.",
      "Explain {x} in a robot voice.",
      "Reenact {x} in slow motion with sound effects.",
      "Laugh like a villain about {x} for 15 seconds.",
      "Do a fake news report about {x}.",
      "Mime {x} until someone guesses it.",
      "Sing about {x} in opera style.",
      "Speak only in rhymes about {x} for one round.",
    ],
  },
  adult: {
    topics: [
      "your dating history",
      "a flirty text",
      "your type",
      "a bad date",
      "a wild night out",
      "your last crush",
      "a secret admirer",
      "a red flag you ignored",
      "your ideal weekend away",
      "a rule you'd break once",
      "your boldest move",
      "your best kiss story",
    ],
    truth: [
      "Spill the honest version of {x}.",
      "What's the detail about {x} you'd only admit after midnight?",
      "Who here would be shocked by {x}?",
      "What's your rating of {x} and why?",
      "What's the boldest thing you've done about {x}?",
      "What would your friends guess wrong about {x}?",
      "What's your biggest regret involving {x}?",
      "How would you handle {x} differently now?",
      "What's the one thing you'd never repeat about {x}?",
      "Who taught you the most about {x}?",
    ],
    dare: [
      "Text your most recent match something about {x}.",
      "Give a confident 20-second pitch about {x}.",
      "Read your last message out loud and connect it to {x}.",
      "Do your most charming smile while describing {x}.",
      "Let the group ask two unfiltered questions about {x}.",
      "Rate everyone's flirting style based on {x}.",
      "Recreate your reaction from {x}.",
      "Whisper a spicy opinion about {x} to the player on your right.",
      "Post a mysterious story caption about {x}.",
      "Act out {x} without saying a single word.",
    ],
  },
};

function build(): Challenge[] {
  const out: Challenge[] = [];
  (Object.keys(BANKS) as Exclude<Category, "custom">[]).forEach((category) => {
    const bank = BANKS[category];
    (["truth", "dare"] as ChallengeType[]).forEach((type) => {
      bank[type].forEach((template, ti) => {
        bank.topics.forEach((topic, oi) => {
          out.push({
            id: `${category}-${type}-${ti}-${oi}`,
            text: template.replace("{x}", topic),
            type,
            category,
            difficulty: DIFFICULTIES[(ti + oi) % 4] as Difficulty,
          });
        });
      });
    });
  });
  return out;
}

export const CHALLENGES: Challenge[] = build();

export const CHALLENGE_COUNTS = {
  truth: CHALLENGES.filter((c) => c.type === "truth").length,
  dare: CHALLENGES.filter((c) => c.type === "dare").length,
};

export const PUNISHMENTS = [
  "Do 15 push-ups right now.",
  "Let the group rename you for 3 rounds.",
  "Speak in an accent until your next turn.",
  "Hold a plank for 30 seconds.",
  "Sing your next sentence.",
  "Hand your phone to the player on your left for one round.",
  "Do 20 jumping jacks.",
  "Wear something silly for the next 2 rounds.",
];

export const REWARDS = [
  "Skip your next turn for free.",
  "Steal 10 XP from any player.",
  "Choose the next player's challenge type.",
  "Get a double-points round.",
  "Immunity from the next punishment.",
  "Pick the next song.",
  "Assign one dare to anyone you want.",
  "Bank an extra skip token.",
];
