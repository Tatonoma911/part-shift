/**
 * Everything the universe site says, in Russian and English.
 * Sources: lore/LORE_BIBLE_KEEPSWEEPER_RESKIN.md, lore/VILLAINS.md, CHARACTER_NAMING_CANON_V1,
 * HEROOUT_CAST_DESIGN_LOCK_V0 and the pre-accident backstory bibles from Anton's PARTSHIFT folders.
 * Personal names from the backstory bibles are proposals, so the site uses callsigns only.
 */
export type Lang = 'ru' | 'en';
export type L = { ru: string; en: string };

const A = 'universe/';
export const img = (p: string) => A + p;

export interface Hero {
  id: string;
  name: L;
  hud: L;
  group: 'canon' | 'city';
  color: string;
  px: string;
  art?: string;
  extra?: { src: string; cap: L }[];
  role: L;
  before: L;
  after?: L;
  module: L;
  tech?: L;
  look: L;
  quote?: L;
  fact?: L;
  inGame: L;
  /** After the gel: what the hero still "rescues" (lore/ENEMIES.md v3). */
  mania?: L;
  /** What the hero says now (text/ru.json hero.line.*). */
  line?: L;
  trophy?: L;
  lair?: L;
  /** Beaten enough times, the hero comes back to themselves and joins you (design/HEROES.md). */
  ally?: L;
  unlock?: L;
  bio?: L;
  back?: L;
  defeat?: L;
  allyLine?: L;
}

export const HEROES: Hero[] = [
  {
    id: 'n73',
    name: { ru: 'Семьдесят Третий', en: 'Seventy-Third' },
    hud: { ru: 'N-73 // НЕЙРОКОНТУР', en: 'N-73 // NEUROCORE' },
    group: 'canon',
    color: '#57D8F2',
    px: 'px/n73.png',
    art: 'dossier-n73.webp',
    role: { ru: 'Экспериментальный нейроконтур HeroOut. Не человек: костяной позвоночник с циановым ядром, в котором записаны навыки и личность героя.', en: 'An experimental HeroOut neurocore. Not a person: a bone spine with a cyan core that stores a hero’s skills and personality.' },
    before: { ru: 'HeroOut научилась сохранять самое дорогое в героях: не тело, а управляющий контур. N-73 был одним из таких «активов» в капсуле на нижнем уровне.', en: 'HeroOut learned to keep the most valuable part of a hero: not the body, but the controlling circuit. N-73 was one such “asset” in a capsule on a lower level.' },
    after: { ru: 'Ночью Доктор запустил связку контура с тяжёлой рукой героя. Рука сжалась не как рефлекс. N-73 проснулся и теперь сам выбирает себе тело.', en: 'One night the Doctor linked the circuit to a hero’s heavy arm. The hand closed, and it was no reflex. N-73 woke up and now chooses his own body.' },
    module: { ru: 'Любое совместимое шасси. Подключается через Splice Medium.', en: 'Any compatible chassis, linked through Splice Medium.' },
    look: { ru: 'Белые позвонки, голубое ядро, тонкие нервные нити', en: 'White vertebrae, a blue core, thin nerve threads' },
    quote: { ru: '«Семьдесят Третий, остановись.» (Контроль)', en: '“Seventy-Third, stop.” (Control)' },
    inGame: { ru: 'Главный герой будущего файтинга PART SHIFT. В текущей игре его пока нет.', en: 'The lead of the upcoming PART SHIFT fighting game. Not in the current game yet.' },
  },
  {
    id: 'doctor',
    name: { ru: 'Доктор', en: 'Doctor' },
    hud: { ru: 'ДОКТОР // ШАССИ', en: 'DOCTOR // CHASSIS' },
    group: 'canon',
    color: '#EDF4F5',
    px: 'px/doctor.png',
    art: 'doctor-arm.webp',
    extra: [
      { src: 'dossier-doctor.webp', cap: { ru: 'Досье: лабораторный врач', en: 'Dossier: lab doctor' } },
    ],
    role: { ru: 'Лабораторный врач и специалист нейроинтерфейса. Первое тело N-73. Обычный мужчина в белом халате, без имени: игрок знает его просто как Доктора.', en: 'A lab physician and neurointerface specialist. N-73’s first body. An ordinary man in a white coat with no name; players know him only as the Doctor.' },
    before: { ru: 'Переводил показания приборов в решения, понятные пациентам. Мечтал о клинике, где интерфейсы подстраиваются под жизнь человека, а не наоборот.', en: 'Turned instrument readings into decisions patients could understand. Dreamed of a clinic where interfaces fit around people’s lives, not the other way round.' },
    after: { ru: 'Его руками нейроконтур впервые сжал кулак. С тяжёлой керамической рукой Килна он стал первым носителем N-73.', en: 'Through his hands the neurocore first made a fist. Wearing Kiln’s heavy ceramic arm, he became N-73’s first host.' },
    module: { ru: 'Человеческое шасси; позже тяжёлая рука Килна', en: 'Human chassis; later Kiln’s heavy arm' },
    look: { ru: 'Белый халат, очки, планшет', en: 'White coat, glasses, tablet' },
    quote: { ru: '«Цифра полезна. Но пациент всё ещё вы.»', en: '“The number is useful. You are still the patient.”' },
    fact: { ru: 'Носит шесть ручек и всё равно одалживает седьмую на каждой консультации.', en: 'Carries six pens and still borrows one at every consultation.' },
    inGame: { ru: 'Появится в файтинге как первое тело героя.', en: 'Appears in the fighting game as the hero’s first body.' },
  },
  {
    id: 's01',
    name: { ru: 'Стандарт', en: 'Standard' },
    hud: { ru: 'S-01 // СТАНДАРТ', en: 'S-01 // STANDARD' },
    group: 'canon',
    color: '#C9D6DB',
    px: 'px/s01.png',
    art: 'dossier-s01.webp',
    extra: [
      { src: 'sprites-02.webp', cap: { ru: 'Обычный житель забирает руку врага: ледяная, потом механическая', en: 'A resident takes an enemy’s arm: ice first, then mechanical' } },
    ],
    role: { ru: 'Серийное резервное человеческое шасси из капсулы. Обычный человек: светлая рубашка, тёмные брюки, обычные руки и ноги.', en: 'A serial backup human chassis from a capsule. An ordinary person: light shirt, dark trousers, ordinary arms and legs.' },
    before: { ru: 'Склады HeroOut хранили тысячи таких тел про запас: «носитель заменяем, личность бесценна».', en: 'HeroOut warehouses kept thousands of these bodies in reserve: “the carrier is replaceable, the personality is priceless.”' },
    after: { ru: 'После аварии пустые шасси «сами встали». Теперь это жители Lumen City, которые рождаются в домах и заново открывают город.', en: 'After the accident the empty chassis “stood up on their own.” Now they are Lumen City’s residents, born in homes and reopening the city block by block.' },
    module: { ru: 'Никакого. Пока не победит врага и не заберёт его часть.', en: 'None, until it defeats an enemy and takes its part.' },
    look: { ru: 'Рубашка, брюки, бейдж HeroOut', en: 'Shirt, trousers, HeroOut badge' },
    inGame: { ru: 'Это твои жители. Они копают кварталы, носят Энергию, учатся в школе спасателей и сами прикручивают трофейные руки и ноги.', en: 'These are your residents. They dig blocks, carry Energy, train at the rescue school and bolt on trophy arms and legs by themselves.' },
  },
  {
    id: 'kiln',
    name: { ru: 'Килн', en: 'Kiln' },
    hud: { ru: 'КИЛН // ТЯЖЁЛАЯ РУКА', en: 'KILN // HEAVY ARM' },
    group: 'canon',
    color: '#E8A33A',
    px: 'px/kiln.png',
    art: 'card-kiln.webp',
    role: { ru: 'Тяжёлый пожарно-спасательный оператор. Выносит людей из огня, расчищает завалы, держит конструкции, пока под ними проходят медики.', en: 'Heavy fire-and-rescue operator. Carries people out of fires, clears debris and holds structures up while medics pass beneath.' },
    before: { ru: 'Огромный и добрый. Извиняется перед дверью, прежде чем её снять, и оценивает каждый стул по «уверенности конструкции». Мечтает превратить заброшенный кинотеатр в мастерскую для района.', en: 'Huge and kind. Apologises to doors before removing them and rates every chair by “structural confidence.” Dreams of turning an abandoned cinema into a neighbourhood workshop.' },
    after: { ru: 'Протокол спасения стал буквальным: Килн изолирует всё подряд и выносит людей «в безопасность», даже если они не просили.', en: 'His rescue protocol turned literal: Kiln isolates everything and carries people “to safety” whether they asked or not.' },
    module: { ru: 'Тяжёлая керамическая рука: таран, броня, бронелом. Не огонь.', en: 'Heavy ceramic arm: ram, armour, armour-breaker. Not fire.' },
    tech: { ru: 'Минерал / удар', en: 'Mineral / impact' },
    look: { ru: 'Охра и янтарь поверх белой керамики, таранная перчатка', en: 'Ochre and amber over white ceramic, a ram gauntlet' },
    quote: { ru: '«Вес на мне. Ты бери человека.»', en: '“I have the weight. You take the person.”' },
    fact: { ru: '«Этот стул настроен оптимистично.»', en: '“This chair is optimistic.”' },
    inGame: { ru: 'Один из первых героев на поле: выходит из убежища и уносит жителей, проламывая стены. Победишь — житель заберёт руку Килна.', en: 'One of the first heroes on the board: leaves his lair and carries residents off through walls. Win and a resident takes Kiln’s arm.' },
  },
  {
    id: 'lineman',
    name: { ru: 'Линейщик', en: 'Lineman' },
    hud: { ru: 'ЛИНЕЙЩИК // КАБЕЛЬНЫЙ МОДУЛЬ', en: 'LINEMAN // CABLE MODULE' },
    group: 'canon',
    color: '#2E55C8',
    px: 'px/lineman.png',
    art: 'card-lineman.webp',
    role: { ru: 'Высотный монтажник и спасатель линий. Чинит фасады и кабели башен, снимает людей, застрявших между этажами.', en: 'High-rise line technician and cable rescuer. Repairs façades and tower power lines, reaches people stranded between floors.' },
    before: { ru: 'Живёт в Glassline, окна смотрят на монорельс. Комментирует каждый узел, как кулинарное шоу. Мечтает о пешеходной тропе по крышам, чтобы семьи видели город сверху.', en: 'Lives in Glassline, windows facing the monorail. Narrates every knot like a cooking show. Dreams of a rooftop path so families can see the city from above.' },
    after: { ru: 'Сломанный протокол: хватает людей петлёй и тащит «в безопасность».', en: 'Broken protocol: lassoes people and drags them “to safety.”' },
    module: { ru: 'Кабельный захват: цепляет, удерживает, работает как резиновое лассо. Это не электрорука.', en: 'Cable grapple: hooks, holds, works like a rubber lasso. Not an electric arm.' },
    tech: { ru: 'Ток (отдельная оголённая рука)', en: 'Current (a separate bare arm)' },
    look: { ru: 'Кобальт и белая куртка, оранжевый кабель на предплечье', en: 'Cobalt and white jacket, orange cable on the forearm' },
    quote: { ru: '«Не смотри вниз. Смотри на меня и сделай один шаг.»', en: '“Do not look down. Look at me, then take one step.”' },
    fact: { ru: '«Кабель в порядке. Это здание пересматривает свои решения.»', en: '“The cable is fine. The building is reconsidering its choices.”' },
    inGame: { ru: 'Один из первых героев на поле: привязывает жителей кабелем к опорам. Победишь — заберёшь кабельный захват.', en: 'One of the first heroes on the board: ties residents to pylons with cable. Win and take the cable grapple.' },
  },
  {
    id: 'frostline',
    name: { ru: 'Фростлайн', en: 'Frostline' },
    hud: { ru: 'ФРОСТЛАЙН // КРИОГЕЛЕВАЯ НОГА', en: 'FROSTLINE // CRYOGEL LEG' },
    group: 'canon',
    color: '#7FD8FF',
    px: 'px/frostline.png',
    art: 'card-frostline.webp',
    extra: [{ src: 'scene-2-pressure-ice.webp', cap: { ru: 'Из комикса «Проверка давления»', en: 'From the comic “Pressure Test”' } }],
    role: { ru: 'Криогелевая медик-спасатель: тушит пожары криогелем и лечит травмы от огня и холода.', en: 'Cryogel firefighter and trauma medic: puts out fires with cryogel and treats burns and frostbite.' },
    before: { ru: 'Подписывает остатки еды точным временем охлаждения. Мечтает о районном классе, где семьи учатся спасать без страха. Боится одного: быстро решить проблему и создать новую, похуже.', en: 'Labels leftovers with the exact cooling time. Dreams of a neighbourhood class where families learn rescue without fear. Fears one thing: solving the visible problem and causing a worse one.' },
    after: { ru: 'Сломанный протокол: «охлаждает» всё вокруг, даже то, что не горит.', en: 'Broken protocol: “cools” everything around her, even what isn’t burning.' },
    module: { ru: 'Криогелевая нога (никогда не рука): замедляет и готовит проводимость.', en: 'Cryogel leg (never an arm): slows targets and primes them for conduction.' },
    tech: { ru: 'Криогель', en: 'Cryogel' },
    look: { ru: 'Чистый циан, пучок, два прозрачных бачка на спине', en: 'Pure cyan, a hair bun, two clear tanks on her back' },
    quote: { ru: '«Охлаждай маршрут, а не всю комнату.»', en: '“Cool the route, not the whole room.”' },
    fact: { ru: '«Я не подумала. Думаю сейчас.»', en: '“I did not think that through. I am thinking now.”' },
    inGame: { ru: 'Криоадаптанты на поле отдают ледяную руку. Криогель плюс ток дают проводящую цепь.', en: 'Cryo adaptants drop an ice arm. Cryogel plus current makes a conductive chain.' },
  },
  {
    id: 'seraph',
    name: { ru: 'Серафим', en: 'Seraph' },
    hud: { ru: 'СЕРАФИМ // ШАССИ', en: 'SERAPH // CHASSIS' },
    group: 'canon',
    color: '#F2E3B3',
    px: 'px/seraph.png',
    art: 'card-seraph.webp',
    extra: [{ src: 'sprites-01.webp', cap: { ru: 'Пиксель-спрайты канона: Серафим справа внизу', en: 'Canon pixel sprites: Seraph bottom right' } }],
    role: { ru: 'Высотная аэроспасательница и целительница. Добирается до крыш, верхних этажей и самолётов, стабилизирует раненых.', en: 'High-altitude aerial rescuer and healer. Reaches roofs, upper floors and aircraft and stabilises the wounded.' },
    before: { ru: 'Говорит тише, когда все кричат. Разговаривает с нимб-дроном как с толковым младшим коллегой и благодарит его после каждой смены.', en: 'Speaks more quietly when everyone else shouts. Talks to her halo-drone like a capable junior colleague and thanks it after every shift.' },
    after: { ru: 'Сломанный протокол медика: «сохраняет» всех, даже врагов.', en: 'Broken medic protocol: she “preserves” everyone, enemies included.' },
    module: { ru: 'Большие механические крылья и нимб-дрон, который лечит.', en: 'Large mechanical wings and a halo-drone that heals.' },
    look: { ru: 'Белый и мягкое золото, крылья больше корпуса', en: 'White and soft gold, wings larger than her body' },
    quote: { ru: '«Смотри на меня. Город подождёт один вдох.»', en: '“Look at me. The city can wait for one breath.”' },
    inGame: { ru: 'Одна из первых героинь на поле: прячется в убежище, её нимб-дрон лечит врагов вокруг.', en: 'One of the first heroes on the board: hides in her lair while her halo-drone heals nearby enemies.' },
  },
  {
    id: 'demon',
    name: { ru: 'Демон', en: 'Demon' },
    hud: { ru: 'ДЕМОН // ШАССИ', en: 'DEMON // CHASSIS' },
    group: 'canon',
    color: '#E03552',
    px: 'px/demon.png',
    art: 'demon-sheet.webp',
    role: { ru: 'Подземный аварийно-спасательный модуль HeroOut: метро, шахты, геотермальные трубы. Четыре полноценные руки и тяжёлый буровой хвост.', en: 'HeroOut’s subsurface rescue unit: metro, mines, geothermal pipes. Four full arms and a heavy drill tail.' },
    before: { ru: 'Стучит по каждой трубе дважды и говорит ей «Не сегодня». Растит помидоры под списанными лампами. Мечтает сделать из старого тоннеля подземный сад и музей.', en: 'Taps every pipe twice and tells it “Not today.” Grows tomatoes under retired inspection lamps. Dreams of turning an old tunnel into an underground garden and museum.' },
    after: { ru: 'Протокол подземного спасения сломался: Демон уверен, что наверху опасно, и уводит людей вниз, в Undersun Works. Обратно никого не выпускает.', en: 'His subsurface rescue protocol broke: Demon is sure the surface is dangerous and leads people down into Undersun Works. He lets no one back up.' },
    module: { ru: 'Буровой хвост с геотермальным инжектором', en: 'Drill tail with a geothermal injector' },
    tech: { ru: 'Термо + удар', en: 'Thermo + impact' },
    look: { ru: 'Чёрно-красная техноброня, четыре руки, бур', en: 'Black-and-red tech armour, four arms, a drill' },
    quote: { ru: '«Земля честная. Изыскания бывают оптимистичны.»', en: '“Ground is honest. Surveys are sometimes optimistic.”' },
    inGame: { ru: 'Первый герой на вызове в «Срочном вызове». Не главный, просто сделан первым. Спит под люком Undersun, фиолетовые числа ⬡ показывают, где. Победишь — заберёшь буровой хвост.', en: 'The first hero on call in “Urgent Call.” Not the main villain, just the first one built. Sleeps under an Undersun hatch; purple ⬡ numbers show where. Beat him and take the drill tail.' },
  },
  // Lumen City rescuers from the concept sheets: comic heroes, not in the current game.
  ...(
    [
      ['current', 'Течение', 'Current', '#1F7FD1', 'Водный спасатель: наводнения, пожары, побережье.', 'Water rescuer: floods, fires and the coast.', 'Водяная пушка и ранец', 'Water cannon and pack', '«Город не обесточен. Просто одна цепь драматизирует.»', '“The city is not dark. One circuit is being dramatic.”'],
      ['mason', 'Каменщик', 'Mason', '#C8612F', 'Геотехник: напорные магистрали, плывущий грунт, фундаменты.', 'Geotechnical responder: pressure mains, unstable ground, foundations.', 'Минеральные анкеры и сканер грунта', 'Mineral anchors and a ground scanner', '«Стена не нервничает. Я нервничаю за неё.»', '“The wall is not nervous. I am nervous on its behalf.”'],
      ['beacon', 'Маяк', 'Beacon', '#9BC53D', 'Эвакуация и поиск пропавших. Зелёная линия ведёт людей к выходу.', 'Evacuation and missing-person search. Her green line guides people out.', 'Сигнальные маяки и сканеры', 'Signal beacons and scanners', '«Зелёная линия. Медленные шаги. Говори со мной.»', '“Green line. Slow steps. Keep talking to me.”'],
      ['canopy', 'Садовница', 'Canopy', '#4E9E3A', 'Городская садовница: сады на крышах, опасные ветки, вертикальные парки.', 'City gardener: rooftop gardens, dangerous branches, vertical parks.', 'Секатор и дроны-растения', 'Pruners and plant drones', '«Сад — это инфраструктура, которая лучше пахнет.»', '“A garden is infrastructure that happens to smell better.”'],
      ['sweep', 'Чистильщик', 'Sweep', '#4FB7A8', 'Санитар: убирает опасный мусор и возвращает людям улицы.', 'Sanitation responder: clears hazardous debris and gives streets back to people.', 'Хим-костюм и уборочный модуль', 'Hazmat suit and a cleaning module', '«Чисто — это не красиво. Чисто — это безопасно трогать.»', '“Clean is not cosmetic. Clean means safe to touch.”'],
      ['patch', 'Патч', 'Patch', '#8A6A4A', 'Спасательная собака с механической лапой. Находит людей, утечки и безопасные проходы.', 'A rescue dog with a mechanical leg. Finds people, leaks and safe passages.', 'Механическая лапа, сенсорная шлейка', 'Mechanical leg, sensor harness', '', ''],
      ['hive', 'Улей', 'Hive', '#E0A126', 'Городской пчеловод: опыление, ульи на крышах, экология.', 'Urban apiarist: pollination, rooftop hives, ecology.', 'Сотовая рука и пчёлы-мониторы', 'Honeycomb arm and monitor bees', '«Маленькое не значит необязательное.»', '“Small does not mean optional.”'],
    ] as const
  ).map(
    ([id, ru, en, color, roleRu, roleEn, modRu, modEn, qRu, qEn]): Hero => ({
      id,
      name: { ru, en },
      hud: { ru: `${ru.toUpperCase()} // HEROOUT`, en: `${en.toUpperCase()} // HEROOUT` },
      group: 'city',
      color,
      px: `px/${id}.png`,
      art: `card-${id}.webp`,
      role: { ru: roleRu, en: roleEn },
      before: { ru: 'Один из спасателей Lumen City до аварии. Герой комиксов «До сирен».', en: 'One of Lumen City’s rescuers before the accident. A hero of the “Before the Sirens” comics.' },
      module: { ru: modRu, en: modEn },
      look: { ru: '', en: '' },
      quote: qRu ? { ru: qRu, en: qEn } : undefined,
      inGame: { ru: 'Пока в комиксах. На поле выйдет в следующих картах как герой на вызове.', en: 'Comics for now. Comes to the board on later maps as the hero on call.' },
    }),
  ),
];

/** The gel's version of each hero: lore/ENEMIES.md v3 and text/ru.json (enemy.*, hero.line.*). */
const MAD: Record<string, [string, string, string, string, string, string, string, string]> = {
  // id: mania ru/en, line ru/en, trophy ru/en, lair ru/en
  kiln: ['Всё ещё выносит людей из огня: хватает жителей и уносит прочь, проламывая стены. Огня при этом нет.', 'Still carries people out of fires: grabs residents and hauls them away through walls. There is no fire.', 'Вынесу. Всех. Отовсюду.', 'I’ll carry you out. Everyone. From everywhere.', 'Рука Килна (Таран)', 'Kiln’s arm (Ram)', 'Пожарная часть', 'The fire station'],
  lineman: ['Всё ещё страхует: привязывает людей кабелем к опорам, «чтобы не упали».', 'Still on belay duty: ties people to pylons with cable “so they don’t fall.”', 'Не двигайтесь. Я вас закреплю. Навсегда.', 'Hold still. I’ll secure you. For good.', 'Кабельный захват (Захват)', 'Cable grapple (Grab)', 'Вышка ЛЭП', 'A power-line tower'],
  frostline: ['Всё ещё тушит: заливает криогелем всё подряд, даже микрореакторы.', 'Still putting out fires: floods everything with cryogel, microreactors included.', 'Всё горячее — потенциальный пожар. Вы горячий.', 'Anything hot is a potential fire. You are hot.', 'Криогелевая нога (Криоудар)', 'Cryogel leg (Cryo strike)', 'Станция криогеля', 'The cryogel station'],
  seraph: ['Всё ещё лечит: её нимб-дрон чинит врагов вокруг, а жителей она уносит по воздуху «в больницу».', 'Still healing: her halo-drone patches up enemies, and she flies residents off “to the hospital.”', 'Вы ещё не ранены? Это ненадолго. Я помогу.', 'Not hurt yet? That won’t last. I’ll help.', 'Крылья (Полёт)', 'Wings (Flight)', 'Вертолётная площадка', 'The helipad'],
  demon: ['Всё ещё спасает под землёй: уводит людей вниз, в Undersun Works, «в безопасность». Обратно никого не выпускает.', 'Still rescuing underground: leads people down into Undersun Works “to safety.” Lets no one back up.', 'Не бойтесь. Внизу никто не горит. Внизу просто жарко.', 'Don’t be afraid. Nobody burns down here. It’s just hot.', 'Буровой хвост (Тепловой выброс)', 'Drill tail (Heat burst)', 'Люк Undersun', 'An Undersun hatch'],
  current: ['«Спасает утопающих»: смывает людей водомётом в залив, чтобы было кого спасать.', '“Saves the drowning”: hoses people into the bay so there’s someone to save.', 'Человек за бортом! Сейчас будет.', 'Man overboard! Any second now.', 'Водомётная рука', 'Water-cannon arm', 'Спасательная станция на пляже', 'The beach rescue station'],
  mason: ['Укрепляет всё: замуровывает двери и окна, «чтобы не обрушилось». Изнутри тоже не выйти.', 'Reinforces everything: walls up doors and windows “so nothing collapses.” Nobody gets out either.', 'Не бойтесь. Я вас укреплю. Изнутри.', 'Don’t worry. I’ll reinforce you. From the inside.', 'Поршневые ноги, щит-опора', 'Piston legs, a brace shield', 'Склад опор', 'The shoring depot'],
  beacon: ['Находит всех: светит прожектором и громко объявляет координаты каждого, кого видит.', 'Finds everyone: shines a searchlight and announces the coordinates of everyone she sees.', 'Вижу вас! Вижу всех! Внимание всем: я вижу всех!', 'I see you! I see everyone! Attention all: I see everyone!', 'Сигнальная голова (видит закрытые кварталы)', 'Signal head (sees into closed blocks)', 'Поисковый пост', 'The search post'],
  canopy: ['Озеленяет всё подряд: заращивает улицы, дома и людей.', 'Greens everything: grows over streets, houses and people.', 'Вам не хватает зелени. Сейчас исправим.', 'You’re short on greenery. Let’s fix that.', 'Секатор-рука', 'Pruner arm', 'Сад на крыше', 'A rooftop garden'],
  sweep: ['Дезинфицирует всё, включая жителей. Особенно жителей.', 'Disinfects everything, residents included. Residents especially.', 'Обнаружена грязь. Обнаружен вы. Совпадение?', 'Dirt detected. You detected. Coincidence?', 'Хим-рука (снимает яд)', 'Hazmat arm (cleanses toxin)', 'Санитарный пункт', 'The sanitation depot'],
  patch: ['Приносит людей хозяевам. Любых людей любым хозяевам.', 'Brings people back to their owners. Any people to any owners.', 'Гав. (Принёс вас. Кому — неважно.)', 'Woof. (Fetched you. For whom doesn’t matter.)', 'Механическая нога (скорость)', 'Mechanical leg (speed)', 'Кинологический пост', 'The K-9 post'],
  hive: ['Следит за всеми пчёлами-дронами и жалит «нарушителей режима».', 'Watches everyone through drone bees and stings “rule breakers.”', 'Вы нарушаете режим тишины. Жжж.', 'You are breaking quiet hours. Bzzz.', 'Сотовая рука с пчёлами', 'Honeycomb arm with bees', 'Пасека на крыше Glassline', 'The Glassline rooftop apiary'],
  n73: ['Меняет тела в поисках себя. Контроль очень хочет вернуть его на склад.', 'Swaps bodies looking for himself. Control very much wants him back in the warehouse.', 'Это тело не моё. И это тоже.', 'This body isn’t mine. Neither is this one.', 'Нейроконтур (особый трофей, позже)', 'Neurocore (a special trophy, later)', 'Капсула на нижнем уровне', 'A capsule on a lower level'],
  s01: ['Серийные резервные тела HeroOut, которые встали сами. Обезумевшие копии приходят тройкой одинаковых: компания экономит на индивидуальности.', 'HeroOut’s serial backup bodies that stood up on their own. The deranged copies come in identical threes: the company saves on individuality.', 'Мы Стандарт. Мы Стандарт. Мы Стандарт.', 'We are Standard. We are Standard. We are Standard.', 'Серийный выпуск', 'Mass production', 'Склад HeroOut', 'A HeroOut warehouse'],
  doctor: ['«Оперирует» всех подряд и щедро раздаёт чужие конечности.', '“Operates” on everyone and hands out other people’s limbs.', 'Откройте рот. Скажите «а». Держите руку. Нет, другую. Нет, чужую.', 'Open wide. Say “ah.” Hold this arm. No, the other one. No, someone else’s.', 'Инъектор-рука', 'Injector arm', 'Клиника Research Campus', 'The Research Campus clinic'],
};
/** Voices from lore/HEROES_VOICES.md and text/ru.json: bio before the disaster, line on coming back, last words when beaten, ally line. */
const VOICE: Record<string, string[]> = {
  s01: ["Резервное тело S-01. Такие стояли на складах HeroOut тысячами «на всякий случай». Случай настал. Теперь одна копия знает, что она не просто копия.", "Backup body S-01. HeroOut kept thousands of them in warehouses “just in case.” The case came. Now one copy knows it is not just a copy.", "Мы… я? Я. Кажется, у меня есть имя. Пока не помню какое.", "We… I? I. I think I have a name. I don’t remember which yet.", "Ошибка… серийного… номера…", "Serial… number… error…", "Я Стандарт. Просто Стандарт. Но я стараюсь.", "I’m Standard. Just Standard. But I try."],
  patch: ["Спасательная собака HeroOut с механической задней лапой. Находил людей под завалами. Был лучшим сотрудником месяца одиннадцать раз подряд, зарплату получал печеньем.", "HeroOut’s rescue dog with a mechanical hind leg. Found people under rubble. Employee of the month eleven times in a row, paid in biscuits.", "Гав! (Простите. Я думал, это игра. Это была не игра.)", "Woof! (Sorry. I thought it was a game. It wasn’t a game.)", "Скулит. (Не надо было брать Энергию. Понял.)", "Whimpers. (Shouldn’t have taken the Energy. Got it.)", "Гав! (Нашёл Энергию! Несу! Не ем!)", "Woof! (Found Energy! Bringing it! Not eating it!)"],
  canopy: ["Озеленяла крыши Lumen City сорок лет, ещё до HeroOut. Компания наняла её «для лица рекламы» и выдала дронов-садовников. Её помидоры до сих пор растут на трёх небоскрёбах.", "Greened Lumen City’s rooftops for forty years, before HeroOut. The company hired her “as the face of the ads” and gave her gardening drones. Her tomatoes still grow on three skyscrapers.", "Батюшки, что ж я наделала. Вы кушали? Давайте я вам хоть грядку посажу. Обычную.", "Goodness, what have I done. Have you eaten? Let me at least plant you a bed. A normal one.", "Ох… прополола меня жизнь.", "Oh… life has weeded me out.", "Посадила возле реактора кустик. Энергии больше будет, вот увидишь.", "Don’t swear in front of the plants. They hear everything."],
  current: ["Водный спасатель береговой службы. Вытащил из залива больше людей, чем кто-либо в истории города. Не умеет отдыхать: в отпуске спасал уток.", "A coast guard water rescuer. Pulled more people out of the bay than anyone in the city’s history. Can’t rest: on holiday he rescued ducks.", "Простите, я вас всех топил? Я думал, вы тонете. Теперь думаю, что это я тонул.", "Sorry, was I drowning all of you? I thought you were drowning. Now I think it was me.", "Буль…", "Glub…", "Вода тёплая, ожогов нет, яд смыт. Можно дальше воевать.", "I’m on shore. Strange feeling."],
  lineman: ["Высотный монтажник, спасатель линий. Однажды висел на кабеле над монорельсом шесть часов, держа ребёнка и бутерброд. Бутерброд тоже спас.", "High-rise line technician and cable rescuer. Once hung on a cable over the monorail for six hours holding a child and a sandwich. Saved the sandwich too.", "Отвяжите меня, пожалуйста. Нет, стоп, я сам. Я же монтажник.", "Untie me, please. No, wait, I’ll do it. I’m a rigger.", "Кабель… оборван…", "Cable… snapped…", "Держу его! Бейте, пока держу!", "Got him! Hit him while I hold!"],
  frostline: ["Криогелевая медик-спасатель. Первая на любом пожаре, последняя уходит. Носит два бачка геля и термос с чаем, который ей ни разу не дали допить.", "Cryogel firefighter and medic. First at every fire, last to leave. Carries two gel tanks and a thermos of tea nobody has ever let her finish.", "Я заморозила реактор? Простите. Он был тёплый. Мне казалось, это логично.", "I froze the reactor? Sorry. It was warm. It seemed logical.", "Возгорание… потушено… окончательно.", "Fire… extinguished… for good.", "Враги замедлились. Холодно им. Мне не жалко.", "Can I have my tea now? Hot. Yes, I know."],
  mason: ["Геотехник, укреплял опоры после землетрясений и разборов завалов. Говорит, что любая беда — это просто плохо рассчитанная нагрузка.", "Geotechnician who shored up supports after earthquakes and cleared rubble. Says every disaster is just a badly calculated load.", "Зачем я вас замуровал? Хороший вопрос. Давайте я лучше построю что-нибудь с дверями.", "Why did I wall you in? Good question. Let me build something with doors instead.", "Конструкция… не выдержала.", "Structure… failed.", "Укрепил ваши дома. Теперь с дверями.", "Reinforced your homes. With doors this time."],
  sweep: ["Санитар химической службы. Отмывал город после аварий на заводах. Единственный, кто читал инструкции на всех баллонах HeroOut, поэтому знает, что в геле было не только лечебное.", "Chemical sanitation crew. Washed the city down after factory accidents. The only one who read the labels on every HeroOut canister, so knows the gel wasn’t only medicine.", "Я вас продезинфицировал? Всех? Ну… зато чисто. Простите.", "I disinfected you? All of you? Well… at least it’s clean. Sorry.", "Загрязнение… устранено… мной.", "Contamination… removed… by me.", "Здесь чисто. Можно стоять.", "It’s clean here. You can stand."],
  beacon: ["Поисковик пропавших, служба Маяк. Находила людей в тоннелях по одному дыханию. Ростом под два метра, поэтому видит всё и всем об этом сообщает.", "Missing-persons searcher, Beacon unit. Found people in tunnels by a single breath. Nearly two metres tall, so she sees everything and tells everyone.", "Я кричала, где вы прячетесь? Всем? Господи. Ладно, теперь буду кричать, где не надо ходить.", "I was shouting where you were hiding? To everyone? Oh no. Fine, now I’ll shout where not to go.", "Сигнал… потерян…", "Signal… lost…", "Вон там пусто, можно копать. Честно.", "That spot is empty, you can dig. Honest."],
  hive: ["Оператор городского мониторинга. Сотни пчёл-дронов следили за пробками, пожарами и цветением лип. Корпорация переписала им задачу на «нарушителей режима».", "City monitoring operator. Hundreds of drone bees watched traffic, fires and the linden blossom. The corporation rewrote their task to “rule breakers.”", "Рой отключён от Контроля. Жжж. Мы снова просто пчёлы. И я.", "Swarm disconnected from Control. Bzzz. We’re just bees again. And me.", "Жжж… тишина.", "Bzzz… silence.", "Рой нашёл гнездо. Вон там. Жжж.", "The swarm found a nest. Over there. Bzzz."],
  kiln: ["Тяжёлый пожарно-спасательный оператор. Самый большой и самый добрый человек в части. Выносил людей из огня на руках и потом угощал их чаем. Керамическую руку называет «Тётя Глина».", "Heavy fire-and-rescue operator. The biggest and kindest person at the station. Carried people out of fires and then made them tea. Calls his ceramic arm “Auntie Clay.”", "Где пожар? Не было пожара? Тогда зачем я… Ладно. Кого теперь прикрыть?", "Where’s the fire? There was no fire? Then why did I… Fine. Who do I cover now?", "Не… вынес…", "Couldn’t… carry…", "Держитесь за мной. Я широкий.", "Stay behind me. I’m wide."],
  seraph: ["Высотная аэроспасательница и целительница. Снимала людей с крыш небоскрёбов и лечила их ещё в воздухе. Дети рисуют её на каждом заборе: крылья, нимб и огромная улыбка.", "High-altitude aerial rescuer and healer. Lifted people off skyscraper roofs and treated them mid-air. Kids draw her on every fence: wings, halo and a huge smile.", "Я лечила гнёзда? Я лечила гнёзда. Больше так не буду. Давайте я лучше вас.", "I was healing nests? I was healing nests. Never again. Let me heal you instead.", "Нимб… гаснет…", "Halo… fading…", "Не стойте под огнём. Я не успеваю лечить вас и философию.", "Don’t stand under fire. I can’t heal both you and your philosophy."],
  doctor: ["Специалист нейроинтерфейса, первое тело Семьдесят Третьего. Знает о геле Splice больше всех, потому что подписывал отчёты, которые никто не читал.", "Neurointerface specialist, Seventy-Third’s first body. Knows more about Splice gel than anyone, because he signed the reports nobody read.", "Вы все с чужими руками. Это я? Это я. Хорошо, тогда я хотя бы прослежу, чтобы приживалось правильно.", "Everyone has someone else’s arms. Was that me? That was me. Then at least I’ll make sure they take properly.", "Диагноз… неутешительный.", "Diagnosis… not encouraging.", "Встаньте. Вы не погибли, я запрещаю.", "Get up. You are not dead, I forbid it."],
  demon: ["Подземный спасатель: метро, шахты, горячие трубы Undersun Works. Четыре руки, чтобы держать своды и вытаскивать людей одновременно. Двадцать лет не видел солнца, потому что всё время кого-то спасал внизу.", "Underground rescuer: metro, mines, the hot pipes of Undersun Works. Four arms to hold up vaults and pull people out at once. Hasn’t seen the sun in twenty years because he was always saving someone below.", "Наверху… и правда не так страшно. Я поднимусь. Только не все сразу, пожалуйста.", "Up here… it really isn’t so scary. I’ll come up. Just not everyone at once, please.", "Наверху… светло…", "Up there… it’s bright…", "Копать? Я копаю. Отойдите от бура.", "Dig? I’m digging. Step away from the drill."],
  n73: ["Экспериментальный нейроконтур HeroOut, герой файтинга. Семьдесят два контура до него не выжили. Он умеет жить в любом теле и ищет, где кончается тело и начинается он сам.", "HeroOut’s experimental neurocore, hero of the fighting game. The seventy-two cores before him didn’t survive. He can live in any body and is looking for where the body ends and he begins.", "Я не актив. Я не копия. Я Семьдесят Третий. И теперь я выбираю, на чьей я смене.", "I am not an asset. I am not a copy. I am Seventy-Third. And now I choose whose shift I’m on.", "Перезагрузка…", "Rebooting…", "Ваши нервы в порядке. Я проверил. Не спрашивайте как.", "Your nerves are fine. I checked. Don’t ask how."],
};
const ALLY: Record<string, [string, string, string, string]> = {
  // id: ally ru/en, unlock ru/en (text/ru.json ally.*.desc, unlock.*)
  s01: ['Серийный выпуск теперь работает на вас: жители появляются на 15 % чаще.', 'Mass production now works for you: residents appear 15% more often.', 'Пройти обучение', 'Finish the tutorial'],
  patch: ['Хороший мальчик снова дома: сгустки Энергии летят к центру вдвое быстрее, а копка даёт на 10 % больше.', 'The good boy is home again: Energy orbs fly to the centre twice as fast and digging gives 10% more.', 'Открыть 30 тайников за все смены', 'Open 30 caches across all shifts'],
  canopy: ['Снова сажает то, что нужно: Микрореакторы и копка дают на 25 % больше Энергии.', 'Plants the right things again: Microreactors and digging give 25% more Energy.', 'Заработать 1000 Энергии за одну смену', 'Earn 1000 Energy in one shift'],
  current: ['Течение снова на нашем берегу: смывает с жителей ожоги, яд и холод и ходит по воде.', 'Current is on our shore again: washes burns, toxin and frost off residents and walks on water.', 'Победить Течение 15 раз', 'Beat Current 15 times'],
  lineman: ['Страхует теперь врагов, и очень крепко: подтягивает их к жителям, а удары рядом с ним бьют током.', 'Now he secures enemies, very firmly: pulls them to residents, and hits near him shock.', 'Вызвать реакцию «Проводящая цепь» 50 раз', 'Trigger Conductive Chain 50 times'],
  frostline: ['Тушит теперь только врагов: все враги рядом с ней замедлены.', 'Now she only puts out enemies: every enemy near her is slowed.', 'Заморозить 200 врагов', 'Freeze 200 enemies'],
  mason: ['Укрепляет то, что надо: здания на 50 % прочнее, завалы разбираются вдвое быстрее.', 'Reinforces the right things: buildings are 50% sturdier, rubble clears twice as fast.', 'Построить 100 зданий за все смены', 'Build 100 buildings across all shifts'],
  sweep: ['Чистит теперь по делу: жители рядом не страдают от раскалённой земли и яда, а лишние части перерабатываются вдвое выгоднее.', 'Cleans for a reason now: nearby residents ignore hot ground and toxin, and spare parts recycle for double.', 'Переработать 50 лишних частей', 'Recycle 50 spare parts'],
  beacon: ['Ищет теперь опасность: даёт сканеру 2 лишних заряда и раз в минуту помечает безопасный квартал.', 'Searches for danger now: gives the scanner 2 extra charges and marks a safe block every minute.', 'Победить, ни разу не вскрыв гнездо случайно', 'Win without ever opening a nest by accident'],
  hive: ['Рой теперь следит за врагами: раз в минуту отмечает одно скрытое гнездо или убежище.', 'The swarm watches enemies now: once a minute it marks a hidden nest or lair.', 'Победить Улей 20 раз', 'Beat Hive 20 times'],
  kiln: ['Снова выносит на себе всё: жители рядом с Килном получают на 20 % меньше урона.', 'Carries everything again: residents near Kiln take 20% less damage.', 'Победить Килна 50 раз', 'Beat Kiln 50 times'],
  seraph: ['Лечит теперь своих: жители рядом с ней восстанавливают здоровье.', 'Heals her own now: residents near her regain health.', 'Победить, не потеряв ни одного жителя', 'Win without losing a single resident'],
  doctor: ['Лечение снова по назначению: раз в 90 секунд поднимает погибшего жителя, а новая часть лечит жителя полностью.', 'Treatment as prescribed again: every 90 seconds he revives a fallen resident, and a new part fully heals.', 'Собрать одному жителю все конечности сразу: две руки, две ноги, хвост и крылья', 'Give one resident every limb at once: two arms, two legs, a tail and wings'],
  demon: ['Наверху ему наконец не страшно: жители копают на 30 % быстрее, а сам Демон пробуривает квартал за 2 секунды.', 'Up top he is finally not afraid: residents dig 30% faster and Demon drills a block in 2 seconds.', 'Победить Демона 10 раз', 'Beat Demon 10 times'],
  n73: ['Нашёл, на чьей он стороне: все жители бьют на 20 % быстрее, а раз в 30 секунд он переманивает адаптанта.', 'Found which side he is on: all residents strike 20% faster, and every 30 seconds he turns an adaptant.', 'Открыть всех остальных 14 героев', 'Unlock all 14 other heroes'],
};
for (const h of HEROES) {
  const v = VOICE[h.id];
  if (v) {
    h.bio = { ru: v[0], en: v[1] };
    h.back = { ru: v[2], en: v[3] };
    h.defeat = { ru: v[4], en: v[5] };
    h.allyLine = { ru: v[6], en: v[7] };
  }
  const a = ALLY[h.id];
  if (a) {
    h.ally = { ru: a[0], en: a[1] };
    h.unlock = { ru: a[2], en: a[3] };
  }
  const m = MAD[h.id];
  if (!m) continue;
  h.mania = { ru: m[0], en: m[1] };
  h.line = { ru: m[2], en: m[3] };
  h.trophy = { ru: m[4], en: m[5] };
  h.lair = { ru: m[6], en: m[7] };
}

/** Control's barks and HeroOut ads for the site (text/ru.json control.bark.*, ad.*). */
export const BARKS: [string, string][] = [
  ['Доброе утро, Lumen City! Напоминаем: все жители являются имуществом HeroOut. Пожалуйста, пройдите на склад.', 'Good morning, Lumen City! A reminder: all residents are HeroOut property. Please proceed to the warehouse.'],
  ['Ваше спасение очень важно для нас. Оставайтесь на линии.', 'Your rescue is very important to us. Please stay on the line.'],
  ['Если вы видите обезумевшего героя, не паникуйте. Он на смене.', 'If you see a deranged hero, do not panic. They are on shift.'],
  ['Кошка снята с дерева. Кошка зарегистрирована как актив HeroOut. Дерево тоже.', 'Cat retrieved from tree. Cat registered as a HeroOut asset. So is the tree.'],
  ['Сопротивление спасению является нарушением пользовательского соглашения, пункт 14.', 'Resisting rescue violates the user agreement, clause 14.'],
  ['Вы довольны тем, что живы? Ответьте «да» или пройдите на склад.', 'Are you satisfied with being alive? Answer “yes” or proceed to the warehouse.'],
  ['Найдена бесхозная рука. Владельца просим пройти на склад. Вместе с остальным телом.', 'An unclaimed arm has been found. The owner is asked to come to the warehouse. With the rest of the body.'],
  ['Напоминаем: на смене находятся четырнадцать героев HeroOut. Все они вас любят.', 'A reminder: fourteen HeroOut heroes are on shift. They all love you.'],
];
/** «Записи Контроля»: in-game Archive finds (lore/ARCHIVE_RECORDS.md, text/ru.json archive.<n>.*). [title, from, text] RU and EN. */
export const ARCHIVE: { title: L; from: L; text: L }[] = (
  [
    ['О кошке', 'About the Cat', 'Отдел инцидентов', 'Incident Department',
      'Кошка на дереве по улице Солнечной зарегистрирована в 412-й раз. Кошка поставлена на баланс как многоразовый инцидент. Дерево тоже. Снимать кошку разрешается не чаще раза в неделю, чтобы не обесценить услугу.',
      'The cat in the tree on Sunny Street has been logged for the 412th time. The cat is now on the books as a reusable incident. So is the tree. Rescue no more than once a week so as not to devalue the service.'],
    ['Уведомление жителям Купола', 'Notice to Dome Residents', 'Контроль', 'Control',
      'Уважаемые жители! С понедельника небо над Куполом облагается абонентской платой. Дождь включён в тариф «Плюс». Солнце — в тариф «Премиум». Темнота бесплатна, пока.',
      'Dear residents! Starting Monday, the sky over the Dome is subscription-based. Rain is included in the Plus plan. Sun is in Premium. Darkness is free, for now.'],
    ['Кран № 14', 'Crane No. 14', 'Внутренняя переписка', 'Internal correspondence',
      '— Кран № 14 сходит с ума в 9:14, патруль проезжает в 9:15. Прошу не путать время, в прошлый раз спасли не тех. — Принято. Предлагаю в 9:13 запустить рекламу «Краны безопасны».',
      '— Crane No. 14 goes crazy at 9:14, the patrol passes at 9:15. Please don\'t mix up the times, last time we rescued the wrong people. — Noted. Suggest running the "Cranes Are Safe" ad at 9:13.'],
    ['Протокол EVERYONE IS ON CALL', 'Protocol EVERYONE IS ON CALL', 'Совет директоров', 'Board of Directors',
      'Пункт 1. Каждый горожанин считается дежурным HeroOut. Пункт 2. Дежурный не может отказаться от дежурства. Пункт 3. Пункты 1 и 2 вступают в силу немедленно и задним числом.',
      'Clause 1. Every citizen is a HeroOut on-call employee. Clause 2. An on-call employee may not decline duty. Clause 3. Clauses 1 and 2 take effect immediately and retroactively.'],
    ['Гель Splice: отчёт маркетинга', 'Splice Gel: Marketing Report', 'Отдел маркетинга', 'Marketing Department',
      'Гель отращивает утраченные конечности. Иногда чужие. Иногда лишние. Предлагаемый слоган: «Иногда — бонус». Отдел безопасности против. Отдел безопасности переведён на склад.',
      'The gel regrows lost limbs. Sometimes someone else\'s. Sometimes extra ones. Proposed slogan: "Sometimes it\'s a bonus." Safety objects. Safety has been moved to the warehouse.'],
    ['Памятка сменщику', 'Memo to Replacements', 'Отдел кадров', 'HR',
      'Вы не оригинал. Оригинал занят или заражён. Не ищите его, не разговаривайте с ним и не берите у него конечности без накладной. Ваша память — собственность компании, пользуйтесь бережно.',
      'You are not the original. The original is busy or infected. Do not look for them, do not talk to them, and do not take their limbs without a waybill. Your memory is company property; handle with care.'],
    ['Правила хранения горожан', 'Citizen Storage Rules', 'Склады Контроля', 'Control Warehouses',
      'Горожан хранить при +18, в сухом месте, не кантовать. Разговоры на полках запрещены, кроме фразы «спасибо, HeroOut». Побег со склада считается порчей имущества.',
      'Store citizens at +18°C, in a dry place, this side up. Talking on shelves is prohibited, except "thank you, HeroOut". Escaping the warehouse counts as damage to property.'],
    ['Ответ 42-го этажа', 'Reply from the 42nd Floor', 'Переписка Контроля', 'Control correspondence',
      '— Смена окончена? — Смена не заканчивается. — Тогда когда отдыхать сотрудникам? — Отдых предусмотрен в тарифе «Премиум». Сотрудники на тарифе «Базовый».',
      '— Is the shift over? — The shift never ends. — Then when do employees rest? — Rest is included in the Premium plan. Employees are on Basic.'],
    ['Подземный отдел', 'Underground Department', 'Отчёт Undersun Works', 'Undersun Works report',
      'Подземный спасатель перевыполнил план эвакуации вниз на 400 %. План эвакуации наверх в отдел не спускался. Рекомендация: спустить. Вниз.',
      'The underground rescuer exceeded the downward evacuation plan by 400%. No upward evacuation plan was ever issued. Recommendation: issue one. Downward.'],
    ['Инвентаризация S-01', 'S-01 Inventory', 'Склад № 4', 'Warehouse No. 4',
      'Резервных тел S-01 было 1200. Утром стало 1197. Днём три тела вернулись и привели ещё три, одинаковых. Пересчёт прекращён: тела просят их не нумеровать.',
      'There were 1,200 S-01 reserve bodies. By morning there were 1,197. By afternoon three came back and brought three more, identical. Recount suspended: the bodies ask not to be numbered.'],
  ] as const
).map(([tr, te, fr, fe, xr, xe]) => ({ title: { ru: tr, en: te }, from: { ru: fr, en: fe }, text: { ru: xr, en: xe } }));

export const ADS: [string, string][] = [
  ['Потеряли руку? Не теряйте надежду! Гель Splice: отрастёт к понедельнику.', 'Lost an arm? Don’t lose hope! Splice gel: grows back by Monday.'],
  ['Купол Lumen. Небо, которое не протекает.', 'The Lumen Dome. A sky that never leaks.'],
  ['Кошка на дереве? Это не случайность. Это повод позвонить.', 'Cat up a tree? That’s no accident. That’s a reason to call.'],
  ['Застрахуйте ногу. Вторая в подарок.', 'Insure one leg. Get the second free.'],
  ['Тариф «Спасение Lite»: спасаем по будним дням с 9 до 18.', '“Rescue Lite” plan: we save you on weekdays, 9 to 6.'],
  ['Ваша семья в безопасности. Ваша семья на складе. Это одно и то же.', 'Your family is safe. Your family is in the warehouse. Same thing.'],
];

export interface Comic {
  id: string;
  title: L;
  series: L;
  cast: L;
  blurb: L;
  pages: { ru: string[]; en: string[] };
}

export const COMICS: Comic[] = [
  {
    id: 'prologue',
    title: { ru: 'HeroOut: всегда на смене', en: 'HeroOut: On Call' },
    series: { ru: 'Пролог', en: 'Prologue' },
    cast: { ru: 'Линейщик, мальчик-фанат', en: 'Lineman, a young fan' },
    blurb: { ru: 'Мальчик вызывает службу спасения ради автографа. Город любит своих героев, а внизу HeroOut уже выращивает им врагов.', en: 'A boy calls the rescue service just to get an autograph. The city loves its heroes, while deep below HeroOut is already growing their enemies.' },
    pages: { ru: ['comics/prologue-ru.webp'], en: ['comics/prologue-ru.webp'] },
  },
  {
    id: 'nothing-happened',
    title: { ru: 'Сегодня ничего не случилось', en: 'Nothing Happened Today' },
    series: { ru: 'До сирен', en: 'Before the Sirens' },
    cast: { ru: 'Килн, Фростлайн', en: 'Kiln, Frostline' },
    blurb: { ru: 'Главная новость дня: Килн на пляже Sunline и раздаёт автографы между подачами.', en: 'Top story of the day: Kiln is at Sunline Beach, signing autographs between serves.' },
    pages: { ru: ['comics/nothing-happened-ru.webp'], en: ['comics/nothing-happened-en.webp'] },
  },
  {
    id: 'pressure-test',
    title: { ru: 'Проверка давления', en: 'Pressure Test' },
    series: { ru: 'До сирен', en: 'Before the Sirens' },
    cast: { ru: 'Фростлайн, Каменщик', en: 'Frostline, Mason' },
    blurb: { ru: 'Фростлайн замораживает фонтан из прорванной магистрали. Давление не согласно.', en: 'Frostline freezes a geyser from a burst main. The pressure disagrees.' },
    pages: { ru: ['comics/pressure-test-ru.webp'], en: ['comics/pressure-test-en.webp'] },
  },
  {
    id: 'two-kinds',
    title: { ru: 'Два вида энергии', en: 'Two Kinds of Power' },
    series: { ru: 'До сирен', en: 'Before the Sirens' },
    cast: { ru: 'Улей, Линейщик', en: 'Hive, Lineman' },
    blurb: { ru: 'Банка мёда на 900 000 калорий и электрик, который отвечает за другую энергию.', en: 'A 900,000-calorie jar of honey and an electrician who handles the other kind of power.' },
    pages: { ru: ['comics/two-kinds-ru.webp'], en: ['comics/two-kinds-en.webp'] },
  },
  {
    id: 'last-donut',
    title: { ru: 'Последний пончик', en: 'The Last Donut' },
    series: { ru: 'До сирен', en: 'Before the Sirens' },
    cast: { ru: 'Улей, Маяк', en: 'Hive, Beacon' },
    blurb: { ru: 'Коробка домашних пончиков на смене, идеально чистый пульт и честный дележ пополам.', en: 'A box of homemade donuts on shift, a spotless console and a perfectly fair split.' },
    pages: {
      ru: [1, 2, 3, 4].map((k) => `comics/last-donut-${k}-ru.webp`),
      en: [1, 2, 3, 4].map((k) => `comics/last-donut-${k}-ru.webp`),
    },
  },
];

export interface Shot {
  src: string;
  cap: L;
  px?: boolean;
}

export const ARTBOOK: { id: string; title: L; note: L; shots: Shot[] }[] = [
  {
    id: 'key',
    title: { ru: 'Ключевой арт', en: 'Key art' },
    note: { ru: 'Спасатели Lumen City до аварии. С этих листов начинается каждый новый рисунок.', en: 'Lumen City’s rescuers before the accident. Every new drawing starts from these sheets.' },
    shots: [
      { src: 'key-art.webp', cap: { ru: 'Команда HeroOut на развалинах после первой смены', en: 'The HeroOut team on the rubble after the first shift' } },
      { src: 'scene-1-sunline-beach.webp', cap: { ru: 'Sunline Beach: выходной, который стал новостью', en: 'Sunline Beach: a day off that became the news' } },
      { src: 'scene-2-pressure-ice.webp', cap: { ru: 'Лёд против давления', en: 'Ice versus pressure' } },
      { src: 'scene-3-hive-terrace.webp', cap: { ru: 'Пасека на крыше Glassline', en: 'A rooftop apiary in Glassline' } },
    ],
  },
  {
    id: 'cards',
    title: { ru: 'Карточки героев', en: 'Hero cards' },
    note: { ru: 'Концепт-листы: полный рост, портрет, палитра и рабочий инструмент. Цвет у каждого героя — его функция.', en: 'Concept sheets: full body, portrait, palette and working tool. Each hero’s colour is their function.' },
    shots: ['kiln', 'lineman', 'frostline', 'current', 'mason', 'beacon', 'canopy', 'sweep', 'patch', 'hive'].map((id) => ({
      src: `card-${id}.webp`,
      cap: { ru: HEROES.find((h) => h.id === id)!.name.ru, en: HEROES.find((h) => h.id === id)!.name.en },
    })),
  },
  {
    id: 'dossier',
    title: { ru: 'Досье файтинга', en: 'Fighting-game dossiers' },
    note: { ru: 'Листы персонажей PART SHIFT Fighting: позы, модули, капсулы.', en: 'PART SHIFT Fighting character sheets: poses, modules, capsules.' },
    shots: [
      { src: 'dossier-n73.webp', cap: { ru: 'N-73 // нейроконтур', en: 'N-73 // neurocore' } },
      { src: 'dossier-doctor.webp', cap: { ru: 'Доктор // специалист нейроинтерфейса', en: 'Doctor // neurointerface specialist' } },
      { src: 'dossier-s01.webp', cap: { ru: 'S-01 // капсульное шасси', en: 'S-01 // capsule chassis' } },
      { src: 'doctor-arm.webp', cap: { ru: 'Доктор с рукой Килна', en: 'The Doctor wearing Kiln’s arm' } },
      { src: 'demon-sheet.webp', cap: { ru: 'Демон: четыре руки и буровой хвост', en: 'Demon: four arms and a drill tail' } },
    ],
  },
  {
    id: 'city',
    title: { ru: 'Город и здания', en: 'City and buildings' },
    note: { ru: 'Белые башни, зелень на крышах, голубое стекло. Двенадцать зданий, которые утвердил Антон.', en: 'White towers, rooftop greenery, blue glass. The twelve buildings Anton approved.' },
    shots: [
      { src: 'city-life.webp', cap: { ru: 'Жизнь города: фанаты героев, уличный повар, гражданский микрореактор', en: 'City life: hero fans, a street chef, a civil microreactor' } },
      { src: 'buildings-sheet.webp', cap: { ru: '12 утверждённых зданий', en: 'The 12 approved buildings' } },
      { src: 'world-locations.webp', cap: { ru: 'Локации: Skyline и Underground', en: 'Locations: Skyline and Underground' } },
      { src: 'style-compass.webp', cap: { ru: 'Визуальный компас HeroOut', en: 'HeroOut visual compass' } },
    ],
  },
  {
    id: 'pixel',
    title: { ru: 'Пиксель-арт игры', en: 'Game pixel art' },
    note: { ru: 'Спрайты героев и жителей для поля.', en: 'Hero and resident sprites for the board.' },
    shots: [
      { src: 'sprites-01.webp', cap: { ru: 'Канон в пикселях', en: 'The canon in pixels' } },
      { src: 'sprites-02.webp', cap: { ru: 'Горожане и автоапгрейд жителя', en: 'Citizens and the resident auto-upgrade' } },
    ],
  },
];

export const DISTRICTS = [
  { id: 'campus', name: 'HeroOut Research Campus', ru: 'Лаборатории, виварий, камеры выращивания. Эпицентр и самые сильные угрозы.', en: 'Labs, vivarium, growth chambers. The epicentre and the strongest threats.' },
  { id: 'glassline', name: 'Glassline District', ru: 'Белые офисные башни, монорельс, рекламные фасады.', en: 'White office towers, the monorail, billboard façades.' },
  { id: 'sunward', name: 'Sunward Homes', ru: 'Уютный пригород: школы, сады, дворы. Здесь начинается первая смена.', en: 'A cosy suburb of schools, gardens and courtyards. The first shift starts here.' },
  { id: 'veins', name: 'Transit Veins', ru: 'Метро, техтоннели и сервисные шахты под всем городом.', en: 'Metro, service tunnels and shafts beneath the whole city.' },
  { id: 'undersun', name: 'Undersun Works', ru: 'Геотермальные станции глубоко внизу. Логово Демона.', en: 'Geothermal stations deep below. Demon’s lair.' },
];

export const TECH = [
  { id: 'thermo', color: '#FF7A3D', ru: 'Термо', en: 'Thermo' },
  { id: 'cryo', color: '#7FD8FF', ru: 'Криогель', en: 'Cryogel' },
  { id: 'volt', color: '#FFD23F', ru: 'Ток', en: 'Current' },
  { id: 'toxin', color: '#8CE05A', ru: 'Токсин', en: 'Toxin' },
  { id: 'impact', color: '#C9A27A', ru: 'Минерал / удар', en: 'Mineral / impact' },
];

export const REACTIONS: { a: string; b: string; ru: string; en: string }[] = [
  { a: 'cryo', b: 'thermo', ru: 'Термошок', en: 'Thermal shock' },
  { a: 'cryo', b: 'volt', ru: 'Проводящая цепь', en: 'Conductive chain' },
  { a: 'thermo', b: 'impact', ru: 'Срыв оболочки', en: 'Shell rupture' },
  { a: 'toxin', b: 'thermo', ru: 'Выжигание', en: 'Burn-out' },
  { a: 'toxin', b: 'volt', ru: 'Нейросбой', en: 'Neural crash' },
];

/** Short UI strings. */
export const UI: Record<string, L> = {
  play: { ru: 'Играть', en: 'Play' },
  playFree: { ru: 'Играть бесплатно', en: 'Play free' },
  heroes: { ru: 'Герои', en: 'Heroes' },
  world: { ru: 'Мир', en: 'World' },
  villains: { ru: 'Злодеи', en: 'Villains' },
  comics: { ru: 'Комиксы', en: 'Comics' },
  artbook: { ru: 'Артбук', en: 'Artbook' },
  home: { ru: 'Главная', en: 'Home' },
  read: { ru: 'Читать', en: 'Read' },
  open: { ru: 'Открыть', en: 'Open' },
  back: { ru: 'Назад', en: 'Back' },
  all: { ru: 'Все герои', en: 'All heroes' },
  close: { ru: 'Закрыть', en: 'Close' },
  menu: { ru: 'Меню', en: 'Menu' },
  universe: { ru: 'Вселенная', en: 'Universe' },
  ruOnly: { ru: '', en: 'Russian lettering for now' },
};
