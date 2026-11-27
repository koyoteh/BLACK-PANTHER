const MONEY_HYPE = /\b(?:easy money|quick money|quick cash|passive income|guaranteed (?:income|profit|returns?)|risk[- ]?free (?:profit|returns?)|make money fast|earn money fast|pata (?:pesa|hela)|ingiza (?:pesa|hela)|(?:earn|make|win|double|pata|ingiza)\b.{0,45}\b(?:money|cash|income|profit|returns?|kes|ksh|pesa|hela|daily|per day))\b/i;
const BUSINESS_OFFER = /\b(?:business opportunity|business offer|investment opportunity|investment scheme|job vacancy|job offer|work from home|online business|online job|forex|cryptocurrency|crypto trading|trading signals?|affiliate marketing|network marketing|mlm|side hustle|fursa ya biashara|biashara mtandaoni|kazi mtandaoni)\b/i;
const CALL_TO_ACTION = /\b(?:dm|pm|inbox|message|whatsapp|text|call|contact)\s+(?:me|us|now|for|on|today)\b|\b(?:join|register|sign up|signup|enroll|apply now|click here|click below|tuma (?:dm|ujumbe)|niandikie|wasiliana nami|jiunge)\b/i;
const URGENCY = /\b(?:limited (?:slots|spaces|seats|spots|offer)|only today|today only|act now|hurry|last chance|don't miss out|do not miss out|few slots left|offer ends soon)\b/i;
const PROMO_LINK = /\b(?:https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/|t\.me\/)/i;

function normalize(text) {
    return String(text || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function detectBusinessPromotion(text) {
    const content = normalize(text);
    if (!content) return null;

    const signals = {
        moneyHype: MONEY_HYPE.test(content),
        businessOffer: BUSINESS_OFFER.test(content),
        callToAction: CALL_TO_ACTION.test(content),
        urgency: URGENCY.test(content),
        promotionalLink: PROMO_LINK.test(content)
    };

    const clearMoneyPitch = signals.moneyHype && (signals.callToAction || signals.urgency || signals.promotionalLink);
    const promotedOffer = signals.businessOffer && signals.callToAction;
    const urgentLinkedOffer = signals.businessOffer && signals.urgency && signals.promotionalLink;
    if (!clearMoneyPitch && !promotedOffer && !urgentLinkedOffer) return null;

    return {
        reason: signals.moneyHype ? 'income or profit claims with a promotion cue' : 'business offer with a recruitment or contact prompt',
        signals
    };
}
