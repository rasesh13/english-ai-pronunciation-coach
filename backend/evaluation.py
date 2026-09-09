from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any


PRACTICE_CATALOG: list[dict[str, Any]] = [
    {"id": "vowels-01", "category": "VOWELS", "phrase": "Thirty-three thoughtful thinkers.", "focus": "thirty-three", "ipa": "/ˈθɜːrti θriː/", "tip": "Keep the tongue lightly between the teeth for each TH sound."},
    {"id": "vowels-02", "category": "VOWELS", "phrase": "The ship is leaving this evening.", "focus": "ship / this", "ipa": "/ʃɪp/ · /ðɪs/", "tip": "Keep the short I relaxed; do not stretch it into EE."},
    {"id": "vowels-03", "category": "VOWELS", "phrase": "I thought the walk was very short.", "focus": "thought", "ipa": "/θɔːt/", "tip": "Round the lips for the long AW vowel and finish with a clear T."},
    {"id": "vowels-04", "category": "VOWELS", "phrase": "Please leave the green sheet on the seat.", "focus": "green / sheet / seat", "ipa": "/ɡriːn/ · /ʃiːt/ · /siːt/", "tip": "Hold the long EE sound consistently without adding a second vowel."},
    {"id": "stress-01", "category": "STRESS", "phrase": "I would like to develop a comfortable routine.", "focus": "develop / comfortable", "ipa": "/dɪˈveləp/ · /ˈkʌmftərbəl/", "tip": "Stress VEL in develop, and compress comfortable to three or four light syllables."},
    {"id": "stress-02", "category": "STRESS", "phrase": "The photographer took an incredible photograph.", "focus": "photographer / photograph", "ipa": "/fəˈtɑːɡrəfər/ · /ˈfoʊtəɡræf/", "tip": "The stress moves: TOG in photographer, PHO in photograph."},
    {"id": "stress-03", "category": "STRESS", "phrase": "Our economic development is accelerating.", "focus": "economic / development", "ipa": "/ˌekəˈnɑːmɪk/ · /dɪˈveləpmənt/", "tip": "Make NOM and VEL the strongest syllables."},
    {"id": "stress-04", "category": "STRESS", "phrase": "This opportunity requires careful preparation.", "focus": "opportunity / preparation", "ipa": "/ˌɑːpərˈtuːnəti/ · /ˌprepəˈreɪʃən/", "tip": "Build toward TOO in opportunity and RAY in preparation."},
    {"id": "rhythm-01", "category": "RHYTHM", "phrase": "Could you schedule the meeting for Thursday?", "focus": "schedule / Thursday", "ipa": "/ˈskedʒuːl/ · /ˈθɜːrzdeɪ/", "tip": "Stress the content words and let could you connect smoothly."},
    {"id": "rhythm-02", "category": "RHYTHM", "phrase": "I can send it to you in the morning.", "focus": "send / morning", "ipa": "/send/ · /ˈmɔːrnɪŋ/", "tip": "Reduce can, to, you, and in; keep send and morning prominent."},
    {"id": "rhythm-03", "category": "RHYTHM", "phrase": "What do you want to do after work?", "focus": "want to", "ipa": "/ˈwɑːnə/", "tip": "Link want to naturally while keeping the final question clear."},
    {"id": "rhythm-04", "category": "RHYTHM", "phrase": "The report should have been ready yesterday.", "focus": "should have been", "ipa": "/ʃʊdəv bɪn/", "tip": "Compress the helper words and stress report, ready, and yesterday."},
    {"id": "names-01", "category": "NAMES", "phrase": "The rural entrepreneur launched a new project.", "focus": "rural / entrepreneur", "ipa": "/ˈrʊrəl/ · /ˌɑːntrəprəˈnɜːr/", "tip": "Keep rural compact and build entrepreneur toward the final NUR stress."},
    {"id": "names-02", "category": "NAMES", "phrase": "Saoirse and Joaquin joined the presentation.", "focus": "Saoirse / Joaquin", "ipa": "/ˈsɜːrʃə/ · /wɑːˈkiːn/", "tip": "Say SUR-sha and wah-KEEN, with one clear stressed syllable in each."},
    {"id": "names-03", "category": "NAMES", "phrase": "Nguyen spoke with Siobhan after the conference.", "focus": "Nguyen / Siobhan", "ipa": "/nwɪn/ · /ʃəˈvɔːn/", "tip": "Keep Nguyen to one compact beat and stress VAWN in Siobhan."},
    {"id": "names-04", "category": "NAMES", "phrase": "Hermione visited Worcestershire in February.", "focus": "Hermione / Worcestershire", "ipa": "/hɜːrˈmaɪəni/ · /ˈwʊstərʃər/", "tip": "Use her-MY-uh-nee and WUSS-ter-sher without reading every written syllable."},
    {"id": "numbers-01", "category": "NUMBERS", "phrase": "My phone number is 805-317-2049.", "focus": "805-317-2049", "ipa": "eight oh five · three one seven · two oh four nine", "tip": "Group the digits, pause briefly between groups, and keep zero as oh consistently."},
    {"id": "numbers-02", "category": "NUMBERS", "phrase": "The total is thirteen thousand three hundred thirty-three.", "focus": "thirteen / thirty-three", "ipa": "/ˌθɜːrˈtiːn/ · /ˈθɜːrti θriː/", "tip": "Stress TEEN in thirteen, but THIR in thirty."},
    {"id": "numbers-03", "category": "NUMBERS", "phrase": "The train leaves at 7:45 on February 14th.", "focus": "7:45 / February 14th", "ipa": "seven forty-five · February fourteenth", "tip": "Group the time naturally and finish fourteenth with a clear TH."},
    {"id": "numbers-04", "category": "NUMBERS", "phrase": "Revenue grew by 12.7 percent in 2026.", "focus": "12.7 percent / 2026", "ipa": "twelve point seven percent · twenty twenty-six", "tip": "Say point clearly and give percent and the year their own beats."},
]


def normalize_words(value: str) -> list[str]:
    return re.findall(r"[a-z]+(?:'[a-z]+)?|\d+", value.lower())


def catalog_entry(target_phrase: str) -> dict[str, Any] | None:
    normalized = " ".join(normalize_words(target_phrase))
    return next((item for item in PRACTICE_CATALOG if " ".join(normalize_words(item["phrase"])) == normalized), None)


def _alignment_issues(target: list[str], spoken: list[str], entry: dict[str, Any] | None) -> list[dict[str, str]]:
    matcher = SequenceMatcher(a=target, b=spoken, autojunk=False)
    issues: list[dict[str, str]] = []
    for tag, a_start, a_end, b_start, b_end in matcher.get_opcodes():
        if tag == "equal":
            continue
        expected = " ".join(target[a_start:a_end]) or "—"
        heard = " ".join(spoken[b_start:b_end]) or "not detected"
        issues.append({
            "word": expected,
            "heardAs": heard,
            "category": entry["category"] if entry else "PRONUNCIATION",
            "tip": entry["tip"] if entry else f"Listen to “{expected}” slowly, then repeat it in the full phrase.",
        })
    return issues[:4]


def evaluate_attempt(target_phrase: str, transcript: str, duration_ms: int) -> dict[str, Any]:
    target_words = normalize_words(target_phrase)
    spoken_words = normalize_words(transcript)
    if not target_words:
        raise ValueError("A target phrase is required.")
    if not spoken_words:
        raise ValueError("No speech was detected. Try the phrase again.")

    entry = catalog_entry(target_phrase)
    matcher = SequenceMatcher(a=target_words, b=spoken_words, autojunk=False)
    content_score = round(matcher.ratio() * 100)
    expected_ms = max(1_200, round(len(target_words) / 2.35 * 1_000))
    actual_ms = duration_ms if duration_ms > 0 else expected_ms
    pace_ratio = actual_ms / expected_ms
    if 0.72 <= pace_ratio <= 1.48:
        delivery_score = 100
    else:
        delivery_score = max(35, round(100 - abs(1 - pace_ratio) * 52))
    score = round(content_score * 0.82 + delivery_score * 0.18)
    issues = _alignment_issues(target_words, spoken_words, entry)

    if not issues and pace_ratio > 1.48:
        issues.append({"word": "delivery", "heardAs": "too slow", "category": "RHYTHM", "tip": "Keep the stressed words clear, but shorten the pauses between them."})
    elif not issues and pace_ratio < 0.72:
        issues.append({"word": "delivery", "heardAs": "too fast", "category": "RHYTHM", "tip": "Slow down slightly and give the stressed words a full beat."})

    if issues:
        summary = f"Focus on {issues[0]['word']}. Hear the model slowly, then repeat the complete phrase at natural speed."
    else:
        summary = "Strong match. Listen once more at natural speed, then repeat it with the same rhythm."

    return {
        "targetPhrase": target_phrase.strip(),
        "transcript": transcript.strip(),
        "score": score,
        "contentScore": content_score,
        "deliveryScore": delivery_score,
        "durationMs": actual_ms,
        "correction": target_phrase.strip(),
        "category": entry["category"] if entry else "CUSTOM",
        "focus": entry["focus"] if entry else (issues[0]["word"] if issues else target_phrase.strip()),
        "phoneticCue": entry["ipa"] if entry else "Listen to the generated model and imitate its stress pattern.",
        "coachingTip": entry["tip"] if entry else summary,
        "issues": issues,
        "summary": summary,
    }
