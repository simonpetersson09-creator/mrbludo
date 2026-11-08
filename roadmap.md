# Roadmap: Nya onlineregler (spec 2026-11-04) — KLAR

## Adminstatistik och tekniska fel (2026-11-08)
- [x] Nollställ adminstatistik med ny mätstart 2026-11-08 09:43 UTC; spelarresultat och diagnostik bevarade, databasverifierat.
- [x] Granska adminens tekniska fel: push-pluginets Promise-assimilering och Androids saknade randomUUID; äldre webbfel inte reproducerade. Endast granskat, inte åtgärdat.

## Implementerat och verifierat
- [x] Privat match: endast värden startar, minst 2 människor, ingen AI-ifyllnad, ingen autostart vid full lobby
- [x] Väninbjudan: accepterad inbjudan startar matchen direkt (separat flöde bevarat)
- [x] Privata matcher: ingen server-AI/autodrag, ingen auto-uppgivning — pausas och återupptas (test: 2 h och 14 dagar)
- [x] Väntrum: platsen tas bara bort vid uttryckligt "Lämna" (verifierat i koden)
- [x] Snabbspel: 6 s färskhet i matchningen (var 10 s), hård timeout på alla nätverksanrop i sökningen
- [x] Snabbspel: AI-övertagande efter 60 s (var 30 s), även vid ansluten men inaktiv spelare; ingen auto-uppgivning
- [x] Notiser: "Datorn spelar för [namn]" + "[namn] är tillbaka" (40 språk)
- [x] Uppgivning under de två första omgångarna → permanent AI-plats om annan människa finns kvar; AI ger aldrig statistik
- [x] Rensning: privat spelande 14 dagar, snabbspel 24 h/10 min, väntande lobby 6 h — verifierat mot databasen
- [x] Schemalagda jobb verifierade: minutjobb (AI-övertagande) + timjobb (rensning), båda aktiva
- [x] 298 tester + typkontroll + bygg grönt

## Kvar att verifiera på riktiga telefoner
- [ ] Två enheter: privat match pausad i timmar och återupptagen med samma ställning
- [ ] Två enheter: snabbspel med AI-övertagande, återkomst och tidig uppgivning
- [ ] Push vid "din tur" i pausad privat match
