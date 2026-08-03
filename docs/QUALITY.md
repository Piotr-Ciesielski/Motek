# Kontrole jakości

Automatyczne bramki jakości działają w CI w kolejności: audyt zależności,
ESLint, Prettier, pokrycie testami oraz pełny zestaw testów składniowych.

`format:check` obejmuje konfiguracje narzędzi, `package.json` i workflow CI.
Starsze moduły i testy nie są automatycznie przepisywane przez Prettier, aby
nie zmieniać tekstowych kontraktów istniejących testów. Kod aplikacji jest
sprawdzany przez ESLint i testy. Pełne ujednolicenie formatowania źródeł może
zostać wykonane osobno, z aktualizacją testów zależnych od dokładnego tekstu.

Pokrycie ma minimalne progi: 60% linii, 60% funkcji, 50% gałęzi i 60%
instrukcji.
