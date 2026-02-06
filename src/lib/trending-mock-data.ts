// src/lib/trending-mock-data.ts
import type {
  TrendingVideo,
  TrendingCategory,
  TrendingStats,
  CategoryStats,
} from "@/types/trending";

/**
 * Mock trending video dataset.
 *
 * 42 videos across 3 categories (14 each) with realistic TikTok metadata.
 * Used as the data layer until real API integration.
 */
export const TRENDING_VIDEOS: TrendingVideo[] = [
  // ─── BREAKING OUT (14 videos) ─── high velocity 8-50x, views 500K-15M ───

  {
    id: "vid_001",
    title: "This pasta trick changed my life forever",
    thumbnailUrl: "https://picsum.photos/seed/pasta-trick/400/500",
    creator: {
      handle: "@chefmaria",
      displayName: "Maria Cooks",
      avatarUrl: "https://picsum.photos/seed/chefmaria/100/100",
    },
    views: 12_400_000,
    likes: 980_000,
    shares: 124_000,
    date: "2026-02-04T14:30:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#viral", "#pasta", "#cookinghack", "#italianfood"],
    tiktokUrl:
      "https://www.tiktok.com/@chefmaria/video/7473829104827364901",
    velocity: 42.3,
  },
  {
    id: "vid_002",
    title: "POV: your cat discovers the robot vacuum",
    thumbnailUrl: "https://picsum.photos/seed/cat-vacuum/400/500",
    creator: {
      handle: "@whiskers_world",
      displayName: "Whiskers World",
      avatarUrl: "https://picsum.photos/seed/whiskers_world/100/100",
    },
    views: 8_700_000,
    likes: 720_000,
    shares: 95_000,
    date: "2026-02-03T10:15:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#catsoftiktok", "#robotvacuum", "#funny"],
    tiktokUrl:
      "https://www.tiktok.com/@whiskers_world/video/7473829104827364902",
    velocity: 38.1,
  },
  {
    id: "vid_003",
    title: "3 phone hacks you didn't know existed",
    thumbnailUrl: "https://picsum.photos/seed/phone-hacks/400/500",
    creator: {
      handle: "@techbro42",
      displayName: "TechBro",
      avatarUrl: "https://picsum.photos/seed/techbro42/100/100",
    },
    views: 14_200_000,
    likes: 1_100_000,
    shares: 210_000,
    date: "2026-02-04T08:00:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#viral", "#techhacks", "#iphone", "#android"],
    tiktokUrl:
      "https://www.tiktok.com/@techbro42/video/7473829104827364903",
    velocity: 50.0,
  },
  {
    id: "vid_004",
    title: "Watch me turn $5 into a gourmet meal",
    thumbnailUrl: "https://picsum.photos/seed/budget-meal/400/500",
    creator: {
      handle: "@budgetbites",
      displayName: "Budget Bites",
      avatarUrl: "https://picsum.photos/seed/budgetbites/100/100",
    },
    views: 6_300_000,
    likes: 490_000,
    shares: 67_000,
    date: "2026-02-03T16:45:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#budgetmeals", "#cooking", "#foodtok"],
    tiktokUrl:
      "https://www.tiktok.com/@budgetbites/video/7473829104827364904",
    velocity: 28.5,
  },
  {
    id: "vid_005",
    title: "This dance is taking over every school right now",
    thumbnailUrl: "https://picsum.photos/seed/school-dance/400/500",
    creator: {
      handle: "@dancequeen_",
      displayName: "Dance Queen",
      avatarUrl: "https://picsum.photos/seed/dancequeen_/100/100",
    },
    views: 11_800_000,
    likes: 920_000,
    shares: 180_000,
    date: "2026-02-04T12:00:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#viral", "#dance", "#dancechallenge"],
    tiktokUrl:
      "https://www.tiktok.com/@dancequeen_/video/7473829104827364905",
    velocity: 35.7,
  },
  {
    id: "vid_006",
    title: "I asked AI to design my entire apartment",
    thumbnailUrl: "https://picsum.photos/seed/ai-apartment/400/500",
    creator: {
      handle: "@designdaily",
      displayName: "Design Daily",
      avatarUrl: "https://picsum.photos/seed/designdaily/100/100",
    },
    views: 9_500_000,
    likes: 780_000,
    shares: 142_000,
    date: "2026-02-02T20:30:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#AI", "#interiordesign", "#apartment", "#viral"],
    tiktokUrl:
      "https://www.tiktok.com/@designdaily/video/7473829104827364906",
    velocity: 31.2,
  },
  {
    id: "vid_007",
    title: "Why everyone is doing cold plunges wrong",
    thumbnailUrl: "https://picsum.photos/seed/cold-plunge/400/500",
    creator: {
      handle: "@fitcoach_sam",
      displayName: "Sam Fitness",
      avatarUrl: "https://picsum.photos/seed/fitcoach_sam/100/100",
    },
    views: 7_100_000,
    likes: 560_000,
    shares: 89_000,
    date: "2026-02-04T06:15:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#coldplunge", "#fitness", "#health"],
    tiktokUrl:
      "https://www.tiktok.com/@fitcoach_sam/video/7473829104827364907",
    velocity: 22.8,
  },
  {
    id: "vid_008",
    title: "The skincare ingredient dermatologists are obsessed with",
    thumbnailUrl: "https://picsum.photos/seed/skincare-derm/400/500",
    creator: {
      handle: "@glowup_guru",
      displayName: "Glow Up Guru",
      avatarUrl: "https://picsum.photos/seed/glowup_guru/100/100",
    },
    views: 5_800_000,
    likes: 430_000,
    shares: 58_000,
    date: "2026-02-03T13:00:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#skincare", "#dermatologist", "#beautytok"],
    tiktokUrl:
      "https://www.tiktok.com/@glowup_guru/video/7473829104827364908",
    velocity: 18.4,
  },
  {
    id: "vid_009",
    title: "My dog learned to open the fridge and I'm not even mad",
    thumbnailUrl: "https://picsum.photos/seed/dog-fridge/400/500",
    creator: {
      handle: "@goldenboy_max",
      displayName: "Max the Golden",
      avatarUrl: "https://picsum.photos/seed/goldenboy_max/100/100",
    },
    views: 10_200_000,
    likes: 850_000,
    shares: 156_000,
    date: "2026-02-04T09:45:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#dogsoftiktok", "#funny", "#goldenretriever"],
    tiktokUrl:
      "https://www.tiktok.com/@goldenboy_max/video/7473829104827364909",
    velocity: 33.6,
  },
  {
    id: "vid_010",
    title: "How I paid off $30K in student loans in one year",
    thumbnailUrl: "https://picsum.photos/seed/student-loans/400/500",
    creator: {
      handle: "@moneymindset",
      displayName: "Money Mindset",
      avatarUrl: "https://picsum.photos/seed/moneymindset/100/100",
    },
    views: 4_600_000,
    likes: 320_000,
    shares: 78_000,
    date: "2026-02-02T18:00:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#finance", "#studentloans", "#moneytips"],
    tiktokUrl:
      "https://www.tiktok.com/@moneymindset/video/7473829104827364910",
    velocity: 15.2,
  },
  {
    id: "vid_011",
    title: "Wait for the plot twist at the end",
    thumbnailUrl: "https://picsum.photos/seed/plot-twist/400/500",
    creator: {
      handle: "@storytime_jay",
      displayName: "Jay Stories",
      avatarUrl: "https://picsum.photos/seed/storytime_jay/100/100",
    },
    views: 13_100_000,
    likes: 1_050_000,
    shares: 198_000,
    date: "2026-02-04T15:30:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#storytime", "#plottwist", "#viral"],
    tiktokUrl:
      "https://www.tiktok.com/@storytime_jay/video/7473829104827364911",
    velocity: 45.0,
  },
  {
    id: "vid_012",
    title: "The one stretch that fixes everything",
    thumbnailUrl: "https://picsum.photos/seed/magic-stretch/400/500",
    creator: {
      handle: "@yoga_with_li",
      displayName: "Li Yoga Flow",
      avatarUrl: "https://picsum.photos/seed/yoga_with_li/100/100",
    },
    views: 3_900_000,
    likes: 290_000,
    shares: 52_000,
    date: "2026-02-03T07:30:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#yoga", "#stretching", "#backpain", "#health"],
    tiktokUrl:
      "https://www.tiktok.com/@yoga_with_li/video/7473829104827364912",
    velocity: 12.1,
  },
  {
    id: "vid_013",
    title: "Making the world's largest cotton candy",
    thumbnailUrl: "https://picsum.photos/seed/giant-candy/400/500",
    creator: {
      handle: "@sweetfactory",
      displayName: "Sweet Factory",
      avatarUrl: "https://picsum.photos/seed/sweetfactory/100/100",
    },
    views: 8_100_000,
    likes: 640_000,
    shares: 112_000,
    date: "2026-02-04T11:15:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#candy", "#satisfying", "#food"],
    tiktokUrl:
      "https://www.tiktok.com/@sweetfactory/video/7473829104827364913",
    velocity: 26.9,
  },
  {
    id: "vid_014",
    title: "Hidden beach only locals know about in Bali",
    thumbnailUrl: "https://picsum.photos/seed/bali-beach/400/500",
    creator: {
      handle: "@wanderlust_em",
      displayName: "Em Travels",
      avatarUrl: "https://picsum.photos/seed/wanderlust_em/100/100",
    },
    views: 5_200_000,
    likes: 410_000,
    shares: 73_000,
    date: "2026-02-02T22:00:00Z",
    category: "breaking-out",
    hashtags: ["#fyp", "#bali", "#travel", "#hiddenbeach", "#traveltok"],
    tiktokUrl:
      "https://www.tiktok.com/@wanderlust_em/video/7473829104827364914",
    velocity: 19.8,
  },

  // ─── TRENDING NOW (14 videos) ─── medium velocity 3-10x, views 2M-50M ───

  {
    id: "vid_015",
    title: "The original corn kid is back with a new obsession",
    thumbnailUrl: "https://picsum.photos/seed/corn-kid-2/400/500",
    creator: {
      handle: "@cornkid_official",
      displayName: "Corn Kid",
      avatarUrl: "https://picsum.photos/seed/cornkid_official/100/100",
    },
    views: 45_000_000,
    likes: 3_800_000,
    shares: 520_000,
    date: "2026-02-01T10:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#cornkid", "#viral", "#comeback"],
    tiktokUrl:
      "https://www.tiktok.com/@cornkid_official/video/7473829104827364915",
    velocity: 9.8,
  },
  {
    id: "vid_016",
    title: "How to actually fold a fitted sheet (finally)",
    thumbnailUrl: "https://picsum.photos/seed/fold-sheet/400/500",
    creator: {
      handle: "@tidyhome_",
      displayName: "Tidy Home",
      avatarUrl: "https://picsum.photos/seed/tidyhome_/100/100",
    },
    views: 28_000_000,
    likes: 2_200_000,
    shares: 380_000,
    date: "2026-02-01T14:30:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#lifehack", "#cleaning", "#hometips"],
    tiktokUrl:
      "https://www.tiktok.com/@tidyhome_/video/7473829104827364916",
    velocity: 7.4,
  },
  {
    id: "vid_017",
    title: "We surprised our teacher with a flash mob",
    thumbnailUrl: "https://picsum.photos/seed/flashmob-teacher/400/500",
    creator: {
      handle: "@classof2026",
      displayName: "Class of 2026",
      avatarUrl: "https://picsum.photos/seed/classof2026/100/100",
    },
    views: 38_000_000,
    likes: 3_200_000,
    shares: 450_000,
    date: "2026-02-02T08:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#viral", "#flashmob", "#teacher", "#wholesome"],
    tiktokUrl:
      "https://www.tiktok.com/@classof2026/video/7473829104827364917",
    velocity: 8.9,
  },
  {
    id: "vid_018",
    title: "Ranking every fast food chicken sandwich blindfolded",
    thumbnailUrl: "https://picsum.photos/seed/chicken-rank/400/500",
    creator: {
      handle: "@tastetesters",
      displayName: "Taste Testers",
      avatarUrl: "https://picsum.photos/seed/tastetesters/100/100",
    },
    views: 22_000_000,
    likes: 1_800_000,
    shares: 290_000,
    date: "2026-02-01T19:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#foodreview", "#chickensandwich", "#blindtaste"],
    tiktokUrl:
      "https://www.tiktok.com/@tastetesters/video/7473829104827364918",
    velocity: 6.5,
  },
  {
    id: "vid_019",
    title: "Day in my life as a firefighter in NYC",
    thumbnailUrl: "https://picsum.photos/seed/nyc-firefighter/400/500",
    creator: {
      handle: "@fdny_mike",
      displayName: "Mike FDNY",
      avatarUrl: "https://picsum.photos/seed/fdny_mike/100/100",
    },
    views: 15_000_000,
    likes: 1_250_000,
    shares: 195_000,
    date: "2026-02-02T12:30:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#dayinmylife", "#firefighter", "#nyc"],
    tiktokUrl:
      "https://www.tiktok.com/@fdny_mike/video/7473829104827364919",
    velocity: 5.3,
  },
  {
    id: "vid_020",
    title: "The outfit that broke the internet this week",
    thumbnailUrl: "https://picsum.photos/seed/viral-outfit/400/500",
    creator: {
      handle: "@fashionfwd_",
      displayName: "Fashion Forward",
      avatarUrl: "https://picsum.photos/seed/fashionfwd_/100/100",
    },
    views: 32_000_000,
    likes: 2_600_000,
    shares: 410_000,
    date: "2026-02-02T16:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#fashion", "#ootd", "#viral", "#style"],
    tiktokUrl:
      "https://www.tiktok.com/@fashionfwd_/video/7473829104827364920",
    velocity: 8.1,
  },
  {
    id: "vid_021",
    title: "I tried every viral cleaning product so you don't have to",
    thumbnailUrl: "https://picsum.photos/seed/cleaning-review/400/500",
    creator: {
      handle: "@cleanqueen_ash",
      displayName: "Ash Cleans",
      avatarUrl: "https://picsum.photos/seed/cleanqueen_ash/100/100",
    },
    views: 18_500_000,
    likes: 1_500_000,
    shares: 240_000,
    date: "2026-02-03T09:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#cleantok", "#cleaning", "#productreview"],
    tiktokUrl:
      "https://www.tiktok.com/@cleanqueen_ash/video/7473829104827364921",
    velocity: 6.2,
  },
  {
    id: "vid_022",
    title: "The math trick your teacher never showed you",
    thumbnailUrl: "https://picsum.photos/seed/math-trick/400/500",
    creator: {
      handle: "@mathwiz_pro",
      displayName: "Math Wiz",
      avatarUrl: "https://picsum.photos/seed/mathwiz_pro/100/100",
    },
    views: 25_000_000,
    likes: 2_000_000,
    shares: 340_000,
    date: "2026-02-02T21:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#math", "#education", "#lifehack"],
    tiktokUrl:
      "https://www.tiktok.com/@mathwiz_pro/video/7473829104827364922",
    velocity: 7.0,
  },
  {
    id: "vid_023",
    title: "Grandma tries VR for the first time and it's pure gold",
    thumbnailUrl: "https://picsum.photos/seed/grandma-vr/400/500",
    creator: {
      handle: "@familyfuntime",
      displayName: "Family Fun Time",
      avatarUrl: "https://picsum.photos/seed/familyfuntime/100/100",
    },
    views: 41_000_000,
    likes: 3_500_000,
    shares: 480_000,
    date: "2026-02-01T15:45:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#grandma", "#VR", "#funny", "#wholesome"],
    tiktokUrl:
      "https://www.tiktok.com/@familyfuntime/video/7473829104827364923",
    velocity: 9.5,
  },
  {
    id: "vid_024",
    title: "Building a tiny house for under $10K",
    thumbnailUrl: "https://picsum.photos/seed/tiny-house/400/500",
    creator: {
      handle: "@buildwithben",
      displayName: "Build With Ben",
      avatarUrl: "https://picsum.photos/seed/buildwithben/100/100",
    },
    views: 12_000_000,
    likes: 950_000,
    shares: 170_000,
    date: "2026-02-03T11:30:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#tinyhouse", "#DIY", "#building", "#budget"],
    tiktokUrl:
      "https://www.tiktok.com/@buildwithben/video/7473829104827364924",
    velocity: 4.8,
  },
  {
    id: "vid_025",
    title: "My toddler roasting everyone at Thanksgiving",
    thumbnailUrl: "https://picsum.photos/seed/toddler-roast/400/500",
    creator: {
      handle: "@momlife_real",
      displayName: "Real Mom Life",
      avatarUrl: "https://picsum.photos/seed/momlife_real/100/100",
    },
    views: 35_000_000,
    likes: 2_900_000,
    shares: 420_000,
    date: "2026-02-01T20:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#momlife", "#toddler", "#funny", "#family"],
    tiktokUrl:
      "https://www.tiktok.com/@momlife_real/video/7473829104827364925",
    velocity: 8.6,
  },
  {
    id: "vid_026",
    title: "How to make restaurant-quality ramen at home",
    thumbnailUrl: "https://picsum.photos/seed/homemade-ramen/400/500",
    creator: {
      handle: "@noodlemaster",
      displayName: "Noodle Master",
      avatarUrl: "https://picsum.photos/seed/noodlemaster/100/100",
    },
    views: 19_000_000,
    likes: 1_550_000,
    shares: 260_000,
    date: "2026-02-02T14:15:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#ramen", "#cooking", "#japanese", "#foodtok"],
    tiktokUrl:
      "https://www.tiktok.com/@noodlemaster/video/7473829104827364926",
    velocity: 5.8,
  },
  {
    id: "vid_027",
    title: "This subway performer deserves a record deal",
    thumbnailUrl: "https://picsum.photos/seed/subway-singer/400/500",
    creator: {
      handle: "@nycmoments",
      displayName: "NYC Moments",
      avatarUrl: "https://picsum.photos/seed/nycmoments/100/100",
    },
    views: 29_000_000,
    likes: 2_400_000,
    shares: 390_000,
    date: "2026-02-03T17:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#music", "#talent", "#subway", "#nyc"],
    tiktokUrl:
      "https://www.tiktok.com/@nycmoments/video/7473829104827364927",
    velocity: 7.7,
  },
  {
    id: "vid_028",
    title: "Turning my balcony into a garden paradise",
    thumbnailUrl: "https://picsum.photos/seed/balcony-garden/400/500",
    creator: {
      handle: "@urbangreen_",
      displayName: "Urban Green",
      avatarUrl: "https://picsum.photos/seed/urbangreen_/100/100",
    },
    views: 8_500_000,
    likes: 680_000,
    shares: 110_000,
    date: "2026-02-03T14:00:00Z",
    category: "trending-now",
    hashtags: ["#fyp", "#garden", "#balcony", "#plants", "#DIY"],
    tiktokUrl:
      "https://www.tiktok.com/@urbangreen_/video/7473829104827364928",
    velocity: 3.9,
  },

  // ─── RISING AGAIN (14 videos) ─── velocity 2-6x, views 200K-8M ───

  {
    id: "vid_029",
    title: "The chocolate cake recipe that went viral 2 years ago is back",
    thumbnailUrl: "https://picsum.photos/seed/choco-cake-2/400/500",
    creator: {
      handle: "@bakingwithrose",
      displayName: "Rose Bakes",
      avatarUrl: "https://picsum.photos/seed/bakingwithrose/100/100",
    },
    views: 7_200_000,
    likes: 580_000,
    shares: 92_000,
    date: "2026-02-01T09:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#baking", "#chocolate", "#cake", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@bakingwithrose/video/7473829104827364929",
    velocity: 5.8,
  },
  {
    id: "vid_030",
    title: "Remember this skateboard trick? Someone finally landed it",
    thumbnailUrl: "https://picsum.photos/seed/skate-trick/400/500",
    creator: {
      handle: "@skatepark_legends",
      displayName: "Skate Legends",
      avatarUrl: "https://picsum.photos/seed/skatepark_legends/100/100",
    },
    views: 4_800_000,
    likes: 380_000,
    shares: 65_000,
    date: "2026-02-02T11:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#skateboarding", "#skate", "#trick"],
    tiktokUrl:
      "https://www.tiktok.com/@skatepark_legends/video/7473829104827364930",
    velocity: 4.2,
  },
  {
    id: "vid_031",
    title: "The ice bucket challenge but make it 2026",
    thumbnailUrl: "https://picsum.photos/seed/ice-bucket-26/400/500",
    creator: {
      handle: "@challengeking",
      displayName: "Challenge King",
      avatarUrl: "https://picsum.photos/seed/challengeking/100/100",
    },
    views: 6_100_000,
    likes: 490_000,
    shares: 78_000,
    date: "2026-02-03T08:30:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#challenge", "#icebucket", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@challengeking/video/7473829104827364931",
    velocity: 5.1,
  },
  {
    id: "vid_032",
    title: "Why this 2024 makeup trend is suddenly everywhere again",
    thumbnailUrl: "https://picsum.photos/seed/makeup-trend-24/400/500",
    creator: {
      handle: "@beautybylina",
      displayName: "Lina Beauty",
      avatarUrl: "https://picsum.photos/seed/beautybylina/100/100",
    },
    views: 3_500_000,
    likes: 270_000,
    shares: 45_000,
    date: "2026-02-02T15:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#makeup", "#beautytok", "#trend", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@beautybylina/video/7473829104827364932",
    velocity: 3.6,
  },
  {
    id: "vid_033",
    title: "That one song from 2023 just hit different now",
    thumbnailUrl: "https://picsum.photos/seed/song-2023/400/500",
    creator: {
      handle: "@musicvibes_",
      displayName: "Music Vibes",
      avatarUrl: "https://picsum.photos/seed/musicvibes_/100/100",
    },
    views: 5_600_000,
    likes: 440_000,
    shares: 71_000,
    date: "2026-02-01T22:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#music", "#throwback", "#nostalgia"],
    tiktokUrl:
      "https://www.tiktok.com/@musicvibes_/video/7473829104827364933",
    velocity: 4.7,
  },
  {
    id: "vid_034",
    title: "The workout routine everyone forgot about is actually the best",
    thumbnailUrl: "https://picsum.photos/seed/old-workout/400/500",
    creator: {
      handle: "@gym_revival",
      displayName: "Gym Revival",
      avatarUrl: "https://picsum.photos/seed/gym_revival/100/100",
    },
    views: 2_800_000,
    likes: 210_000,
    shares: 38_000,
    date: "2026-02-03T06:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#workout", "#fitness", "#gym", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@gym_revival/video/7473829104827364934",
    velocity: 3.1,
  },
  {
    id: "vid_035",
    title: "This street food vendor went viral again after 3 years",
    thumbnailUrl: "https://picsum.photos/seed/street-food-3/400/500",
    creator: {
      handle: "@streetfoodfiles",
      displayName: "Street Food Files",
      avatarUrl: "https://picsum.photos/seed/streetfoodfiles/100/100",
    },
    views: 7_800_000,
    likes: 620_000,
    shares: 98_000,
    date: "2026-02-02T18:30:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#streetfood", "#food", "#viral", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@streetfoodfiles/video/7473829104827364935",
    velocity: 5.5,
  },
  {
    id: "vid_036",
    title: "The cat vs cucumber trend is making a comeback",
    thumbnailUrl: "https://picsum.photos/seed/cat-cucumber/400/500",
    creator: {
      handle: "@petmemes_daily",
      displayName: "Pet Memes",
      avatarUrl: "https://picsum.photos/seed/petmemes_daily/100/100",
    },
    views: 4_100_000,
    likes: 320_000,
    shares: 55_000,
    date: "2026-02-01T13:30:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#cats", "#cucumber", "#funny", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@petmemes_daily/video/7473829104827364936",
    velocity: 3.8,
  },
  {
    id: "vid_037",
    title: "Revisiting the ratatouille recipe that broke TikTok",
    thumbnailUrl: "https://picsum.photos/seed/ratatouille-og/400/500",
    creator: {
      handle: "@tiktok_chef",
      displayName: "TikTok Chef",
      avatarUrl: "https://picsum.photos/seed/tiktok_chef/100/100",
    },
    views: 5_300_000,
    likes: 420_000,
    shares: 68_000,
    date: "2026-02-03T12:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#ratatouille", "#cooking", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@tiktok_chef/video/7473829104827364937",
    velocity: 4.5,
  },
  {
    id: "vid_038",
    title: "The sea shanty trend is back and better than ever",
    thumbnailUrl: "https://picsum.photos/seed/sea-shanty-2/400/500",
    creator: {
      handle: "@shantyking",
      displayName: "Shanty King",
      avatarUrl: "https://picsum.photos/seed/shantyking/100/100",
    },
    views: 6_500_000,
    likes: 510_000,
    shares: 82_000,
    date: "2026-02-02T20:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#seashanty", "#music", "#throwback", "#singing"],
    tiktokUrl:
      "https://www.tiktok.com/@shantyking/video/7473829104827364938",
    velocity: 5.3,
  },
  {
    id: "vid_039",
    title: "People are doing the bottle flip challenge again somehow",
    thumbnailUrl: "https://picsum.photos/seed/bottle-flip-2/400/500",
    creator: {
      handle: "@trickshot_crew",
      displayName: "Trick Shot Crew",
      avatarUrl: "https://picsum.photos/seed/trickshot_crew/100/100",
    },
    views: 3_200_000,
    likes: 250_000,
    shares: 42_000,
    date: "2026-02-01T16:45:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#bottleflip", "#challenge", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@trickshot_crew/video/7473829104827364939",
    velocity: 3.4,
  },
  {
    id: "vid_040",
    title: "This cloud bread recipe just got a 2026 upgrade",
    thumbnailUrl: "https://picsum.photos/seed/cloud-bread-2/400/500",
    creator: {
      handle: "@bakingtrends",
      displayName: "Baking Trends",
      avatarUrl: "https://picsum.photos/seed/bakingtrends/100/100",
    },
    views: 2_400_000,
    likes: 190_000,
    shares: 31_000,
    date: "2026-02-03T10:30:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#cloudbread", "#baking", "#recipe", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@bakingtrends/video/7473829104827364940",
    velocity: 2.9,
  },
  {
    id: "vid_041",
    title: "The penny floor DIY is trending again on home reno TikTok",
    thumbnailUrl: "https://picsum.photos/seed/penny-floor/400/500",
    creator: {
      handle: "@diy_dan",
      displayName: "DIY Dan",
      avatarUrl: "https://picsum.photos/seed/diy_dan/100/100",
    },
    views: 1_800_000,
    likes: 140_000,
    shares: 24_000,
    date: "2026-02-02T07:15:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#DIY", "#pennyfloor", "#homereno", "#throwback"],
    tiktokUrl:
      "https://www.tiktok.com/@diy_dan/video/7473829104827364941",
    velocity: 2.3,
  },
  {
    id: "vid_042",
    title: "Dusting off the fidget spinner for a new trick compilation",
    thumbnailUrl: "https://picsum.photos/seed/fidget-spinner/400/500",
    creator: {
      handle: "@spinmaster_og",
      displayName: "Spin Master OG",
      avatarUrl: "https://picsum.photos/seed/spinmaster_og/100/100",
    },
    views: 950_000,
    likes: 72_000,
    shares: 13_000,
    date: "2026-02-01T11:00:00Z",
    category: "rising-again",
    hashtags: ["#fyp", "#fidgetspinner", "#throwback", "#tricks"],
    tiktokUrl:
      "https://www.tiktok.com/@spinmaster_og/video/7473829104827364942",
    velocity: 2.1,
  },
];

/**
 * Filter trending videos by category.
 */
export function getVideosByCategory(
  category: TrendingCategory,
): TrendingVideo[] {
  return TRENDING_VIDEOS.filter((v) => v.category === category);
}

/**
 * Get all trending videos.
 */
export function getAllVideos(): TrendingVideo[] {
  return TRENDING_VIDEOS;
}

/**
 * Compute aggregate statistics across all trending videos.
 */
export function getTrendingStats(): TrendingStats {
  const byCategory: Record<TrendingCategory, CategoryStats> = {
    "breaking-out": { count: 0, totalViews: 0 },
    "trending-now": { count: 0, totalViews: 0 },
    "rising-again": { count: 0, totalViews: 0 },
  };

  let totalViews = 0;

  for (const video of TRENDING_VIDEOS) {
    byCategory[video.category].count += 1;
    byCategory[video.category].totalViews += video.views;
    totalViews += video.views;
  }

  return {
    totalVideos: TRENDING_VIDEOS.length,
    totalViews,
    byCategory,
  };
}
