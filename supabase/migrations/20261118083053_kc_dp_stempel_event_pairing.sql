create or replace view public.kc_dp_stempel_paare as
 WITH b AS (
         SELECT s.id,
            s.org_id,
            s.event_id,
            s.person_id,
            s.member_no,
            s.art,
            s.zeit,
            s.erfasst_am,
            s.quelle,
            s.geraet,
            s.dienst_ref,
            s.dienst_start,
            s.dienst_ende,
            s.grund,
            s.pause_min,
            s.vor_ort,
            s.spontan,
            s.nachgetragen,
            s.korrektur_von,
            s.storniert_am,
            s.storniert_von,
            s.erstellt_von,
            s.kasse_event_id,
            s.schema,
            lead(s.art) OVER w AS n_art,
            lead(s.zeit) OVER w AS n_zeit,
            lead(s.id) OVER w AS n_id,
            lead(s.pause_min) OVER w AS n_pause,
            lead(s.grund) OVER w AS n_grund,
            lead(s.quelle) OVER w AS n_quelle,
            lag(s.art) OVER w AS v_art
           FROM kc_dp_stempel s
          WHERE s.storniert_am IS NULL
          WINDOW w AS (PARTITION BY s.org_id, s.person_id, s.event_id ORDER BY s.zeit, s.erfasst_am, s.id)
        )
 SELECT b.org_id,
    b.event_id,
    b.person_id,
    b.member_no,
    b.id AS kommen_id,
        CASE
            WHEN b.n_art = 'out'::text THEN b.n_id
            ELSE NULL::uuid
        END AS gehen_id,
    b.zeit AS kommen,
        CASE
            WHEN b.n_art = 'out'::text THEN b.n_zeit
            ELSE NULL::timestamp with time zone
        END AS gehen,
        CASE
            WHEN b.n_art = 'out'::text THEN COALESCE(b.n_pause, 0)
            ELSE NULL::integer
        END AS pause_min,
    b.dienst_ref,
    timezone('Europe/Berlin'::text, b.zeit)::date AS work_date,
        CASE
            WHEN b.n_art = 'out'::text THEN 'complete'::text
            ELSE 'missing_end'::text
        END AS status,
    b.quelle AS quelle_kommen,
        CASE
            WHEN b.n_art = 'out'::text THEN b.n_quelle
            ELSE NULL::text
        END AS quelle_gehen,
    b.grund AS grund_kommen,
        CASE
            WHEN b.n_art = 'out'::text THEN b.n_grund
            ELSE NULL::text
        END AS grund_gehen,
    b.vor_ort,
    b.spontan
   FROM b
  WHERE b.art = 'in'::text
UNION ALL
 SELECT b.org_id,
    b.event_id,
    b.person_id,
    b.member_no,
    NULL::uuid AS kommen_id,
    b.id AS gehen_id,
    NULL::timestamp with time zone AS kommen,
    b.zeit AS gehen,
    COALESCE(b.pause_min, 0) AS pause_min,
    b.dienst_ref,
    timezone('Europe/Berlin'::text, b.zeit)::date AS work_date,
    'missing_start'::text AS status,
    NULL::text AS quelle_kommen,
    b.quelle AS quelle_gehen,
    NULL::text AS grund_kommen,
    b.grund AS grund_gehen,
    b.vor_ort,
    b.spontan
   FROM b
  WHERE b.art = 'out'::text AND b.v_art IS DISTINCT FROM 'in'::text;