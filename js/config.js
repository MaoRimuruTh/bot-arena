// Public Firebase web config (identifies the project; access is enforced by Firestore rules).
export const firebaseConfig = {
  apiKey: "AIzaSyBgIDihByKBnZ8xpKH4bqcodUHXaWbCBoE",
  authDomain: "bot-arena-8af86.firebaseapp.com",
  projectId: "bot-arena-8af86",
  storageBucket: "bot-arena-8af86.firebasestorage.app",
  messagingSenderId: "851586393294",
  appId: "1:851586393294:web:2e82beee159e5879cc9c9f",
};
// Card data and art are read live from the official BoT CDN at play time (nothing is copied into this repo).
export const CARD_SOURCE = {
  dataUrl: "https://cdn.bottcg.com/data/cards.feab7649.json",
  imgBase: "https://cdn.bottcg.com/cards/",
  folders: { SD09: "123v1k1/", BT12: "thankyoupnes/", B2SA: "thankyoupnes/", B2SB: "thankyoupnes/", RM01: "0aslabe/" },
};
export const FB_VERSION = "10.12.2";
