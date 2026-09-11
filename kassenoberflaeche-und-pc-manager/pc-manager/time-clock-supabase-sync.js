// Die eigentliche DP2-Übertragung lebt im Stechuhr-Modul. Diese kleine Integrationsdatei
// dokumentiert und prüft beim Start, dass Supabase-Sitzung und Stechuhr gemeinsam geladen sind.
(function(g){'use strict';function ready(){if(g.KCTimeClockManager&&g.KCSupabase)g.dispatchEvent(new CustomEvent('kc-timeclock-supabase-ready',{detail:{version:'1.0.0'}}));}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();})(window);
