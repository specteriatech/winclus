# Plan para poder decir «cumplimos en todo» en Colombia

Estado al 17 de septiembre de 2026 (widget 0.6.4). La matriz norma por norma está publicada en
winclus.com/cumplimiento. Este documento es la parte de trabajo: qué falta, quién lo hace, en qué orden y
con qué plantillas.

## Lo que ya está cerrado (hecho por el equipo técnico el 17-sep-2026)

1. PDF de la guía y del manual etiquetados (estructura, idioma `es`, índice): Anexo 1, capítulo 3.3.
2. Hash de integridad (SRI, SHA-384) del widget publicado en integrar, manual, README, WordPress y Drupal: Anexo 3.
3. Cabeceras de seguridad en winclus.com: HSTS, CSP, Referrer-Policy, X-Frame-Options, Permissions-Policy: Anexo 3.
4. Informe de conformidad (ACR) corregido: 1.3.5 no aplica; queda un solo «parcial» (servicio de apoyo sin teléfono).
5. Mapa del sitio en el pie de todas las páginas y `sitemap.xml`: Anexo 1, apartado 1.6.
6. Winclus Audit dice qué no puede comprobar y lista la revisión manual obligatoria (CC1 a CC32 y capítulo 3).
7. Declaración de accesibilidad con fecha, método, responsable y lo pendiente: Anexo 1.

## Lo que falta y solo puede cerrar una persona

### A. Evaluación independiente (2 a 4 semanas, la que más pesa ante una entidad)

Qué es: un experto en accesibilidad ajeno a Winclus evalúa el widget y winclus.com contra las WCAG 2.1 AA y
el Anexo 1, con lector de pantalla (NVDA y JAWS), solo teclado, zoom 200 % y móvil, y firma un informe.

A quién pedirlo (uno basta): consultoras colombianas de accesibilidad digital, profesionales con certificación
IAAP (CPACC o WAS), o el equipo de accesibilidad de una universidad con programa de inclusión. Pide que el
informe siga la plantilla WCAG-EM del W3C y que liste criterio por criterio.

Correo modelo:

> Asunto: Evaluación independiente de accesibilidad (WCAG 2.1 AA y Resolución 1519) de un widget de tecnología de apoyo
>
> Buenos días. Somos Winclus (winclus.com), un widget web de tecnología de apoyo que permite usar cualquier
> sitio con la cara, la voz, un solo pulsador, teclado en pantalla y pictogramas. Buscamos una evaluación
> independiente, con informe firmado, del widget y de winclus.com contra las WCAG 2.1 nivel AA y el Anexo 1 de la
> Resolución 1519 de 2020, siguiendo la metodología WCAG-EM. Nuestra autoevaluación, el ACR y las pruebas
> automáticas están en winclus.com/accesibilidad y winclus.com/evidencia. Alcance: el panel del widget (siete
> pestañas), el teclado en pantalla, el tablero de pictogramas, la lectura limpia, el barrido y las doce páginas
> del sitio. ¿Podrían enviarnos una propuesta con plazo y precio? Gracias.

Cuando llegue el informe: se publica en winclus.com/accesibilidad («Evaluación externa»), se corrigen los
hallazgos y se repite la evaluación de lo corregido.

### B. Pruebas con personas con discapacidad (3 a 6 semanas)

Qué es: sesiones con personas reales según docs/pruebas-con-usuarios.md (45 minutos, ocho grupos, cinco
personas por grupo). Para empezar esta semana: winclus.com/guion-prueba (diez minutos, una persona).

Orden sugerido: (1) mayores de 70 y discapacidad cognitiva, porque son quienes más dependen de que el panel
se entienda; (2) motriz severa con pulsador; (3) baja visión y ceguera; (4) sordera con LSC; (5) sin habla.

A quién convocar: las entidades de la tabla del protocolo (INCI, INSOR, FENASCOL, Fundación Saldarriaga
Concha, asociaciones de Parkinson y ELA, centros de mayores). Consentimiento informado en
docs/consentimiento-informado.md.

Correo modelo:

> Asunto: Invitación a probar una tecnología de apoyo gratuita (sesión de 45 minutos)
>
> Buenos días. Winclus es un programa que permite usar páginas web con la cara, la voz, un pulsador o
> pictogramas, pensado para trámites del Estado. Queremos comprobar con personas [del grupo] que de verdad les
> sirve, no evaluar a nadie. Buscamos cinco personas para una sesión de 45 minutos, presencial o por
> videollamada, con consentimiento informado y sin datos personales en el informe. Cubrimos transporte y
> ofrecemos el resultado a su organización. ¿Podríamos coordinar fechas? Gracias.

Resultado: informe con la plantilla docs/informe-pruebas-plantilla.md, publicado en winclus.com/accesibilidad.

### C. Concepto jurídico sobre datos y línea de soporte (1 a 2 semanas)

Qué es: un abogado con experiencia en Ley 1581 de 2012 responde por escrito tres preguntas:

1. Si Winclus, que procesa la imagen de la cara solo en el equipo de la persona y nunca la recibe, es
   «responsable del tratamiento» de un dato sensible en el sentido de los artículos 3 y 5 de la Ley 1581.
2. Si Winclus debe inscribir bases de datos en el Registro Nacional de Bases de Datos (Decreto 1074 de 2015,
   artículo 2.2.2.26.1.2: obligación para sociedades con activos superiores a 100.000 UVT y para entidades
   públicas), y si la política de tratamiento publicada en winclus.com/privacidad cumple el artículo 13 del
   Decreto 1377 de 2013.
3. Qué cláusula debe firmar una entidad que instala el widget, en su contrato y en su política de datos, para
   repartir bien los papeles de responsable y encargado.

Con la respuesta se ajustan winclus.com/privacidad y la cláusula modelo de winclus.com/manual.

Línea de soporte: un número de teléfono o WhatsApp con horario publicado (por ejemplo, lunes a viernes de 8 a
17) en winclus.com/accesibilidad y en el «Acerca de» del widget. Es lo único que falta para que el criterio 12.2
de la EN 301 549 (servicio de apoyo) pase de «parcial» a «cumple».

## Orden recomendado

| Semana | Qué |
|---|---|
| 1 | Publicar teléfono de soporte. Enviar los correos A y C. Hacer tres pruebas de diez minutos con el guion. |
| 2 a 3 | Recibir concepto jurídico y ajustar privacidad y manual. Convocar el grupo 1 de pruebas. |
| 3 a 6 | Evaluación externa en marcha; sesiones con los grupos 1 a 3; corregir lo que salga. |
| 6 a 8 | Publicar informe externo e informe de pruebas. Actualizar declaración y matriz. Entonces sí: «cumplimos en todo». |
