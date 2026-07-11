export type PostTitleAfter = "off" | "boldLine" | "wavyLine";

export const site = {
  title: "Vertin - Misaka Foundation",
  titleIndex: "御坂誉",
  description: "Vertin - Misaka Foundation",
  author: {
    name: "Suzuka",
    avatar: "/images/avatar-1.webp"
  },
  logoIndex: "/images/avatar.webp",
  logoIndexUrl: "/",
  footerInfo:
    "<small><p><b>美丽新世界</b><br><a href=\"https://misakafund.org\">御坂基金会</a>授权</p></small>",
  footerScript: "",
  postsPerPage: 5,
  leftSideCustomCode:
    "<img src=\"/persistent-image/2252397-black.webp\" />",
  show: {
    search: true,
    toc: true,
    tag: true,
    category: true,
    cardCategory: false,
    wordCount: true,
    copyright: true
  },
  postTitleAfter: "boldLine" as PostTitleAfter,
  ccLicense: "by-nc-sa" as const,
  themeColor: "yellow" as const,
  navItems: [
    { label: "首页", href: "/", order: 0 },
    { label: "归墟 Archives", href: "/archives", order: 2 }
  ],
  archivesCover: "/persistent-image/image1_waifu2x_2560x1440_3n.webp",
  comments: {
    provider: "twikoo",
    envId: "https://twikoo-steel-beta.vercel.app/"
  },
  aplayer: {
    enabled: true,
    theme: "#ab8748",
    listFolded: true,
    listMaxHeight: 90,
    audio: [
      {
        name: "The Full Mix (Bonus Track)",
        url: "/playlist/10.-The-Full-Mix-Bonus-Track.mp3",
        cover: "/playlist/00.-2-Mello-Superliminal-The-Lo-Fi-Mix.webp"
      },
      {
        name: "Strange Worlds",
        url: "/playlist/Laryssa-Okada-Manifold-Garden-Original-Soundtrack-26-Strange-Worlds.mp3",
        cover: "/playlist/Laryssa-Okada-Manifold-Garden-Original-Soundtrack-26-Strange-Worlds-mp3-image.webp"
      },
      {
        name: "Animenz-Only-my-railgun-某科学的超电磁炮-OP1",
        url: "/playlist/Animenz-Only-my-railgun-某科学的超电磁炮-OP1.mp3",
        cover: "/playlist/Animenz-Only-my-railgun-某科学的超电磁炮-OP1-mp3-image.webp"
      },
      {
        name: "08M34-End-Credit-Day-One",
        url: "/playlist/Hans-Zimmer-08M34-End-Credit-Day-One-v10.03-／-End-Credit-2-Day-One-v7.09-／-End-Credit-3-08M32.mp3",
        cover: "/playlist/Hans-Zimmer-08M34-End-Credit-Day-One-v10-03-／-End-Credit-2-Day-One-v7-09-／-End-Credit-3-08M32-mp3-image.webp"
      }
    ] as Array<{ name: string; url: string; cover: string }>
  }
};

export type ThemeColor = typeof site.themeColor;
