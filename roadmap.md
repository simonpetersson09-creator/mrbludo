# Roadmap: Nya onlineregler (spec 2026-11-04) — KLAR

## Adminstatistik och tekniska fel (2026-11-08)
- [x] Undanta Simons bekräftade iPhone/konto från adminens aktivitetsstatistik, historiskt och framåt; resultat och diagnostik bevarade. 6 enhetstester + isolerat databastest godkända; riktig admin visar 0 aktiva enheter idag. Publicerad admin kräver publicering av ändringen.
- [x] Datumrader i tabell och diagram börjar vid statistikens nollställning 8 november; inga tomma oktoberrader före mätstart.
- [x] Dölj tekniska fel och annonshändelser i admin utan att radera loggar; appstartsdiagnostik börjar 8 november 2026 UTC, inom rullande 30 dagar.
- [x] Rättat adminvyn efter Yatzys fullbreddstabell, kolumnkontroller, rekord och linjediagram. 12 tester godkända; riktig admin verifierad på dator/mobil, 509 diagnostikrader hämtade/kopierade. Ludos befintliga mätvärden används; saknade uppdelningar visas som —, UTC och rullande 30 dagar behålls. Utloggning ersätts av tillbaka för att bevara spelaridentiteten.
- [x] Yatzys AdMob-diagnostiksektion i Ludo: utfällning, hämta 30 dagar, kopiera, samma loggruta och uppdatera-knapp; 509 riktiga rader hämtade/kopierade som admin. 357 tester och 34 isolerade databastester godkända. Övriga adminens dagstabell/diagram är fortsatt Ludos, inte kopior av hela Yatzy-admin.
- [x] Detaljerad, integritetssäker tidsmätning för profil, vänner och snabbspel i befintliga serverloggar; 356 tester och 33 isolerade databastester godkända. Verkliga nya mätvärden kräver publicering och appaktivitet.
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
