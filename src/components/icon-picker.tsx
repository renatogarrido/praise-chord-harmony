import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Group = { name: string; icons: { e: string; k: string }[] };

const GROUPS: Group[] = [
  {
    name: "Smileys",
    icons: [
      ["😀","grin"],["😃","smile"],["😄","happy"],["😁","beam"],["😆","laugh"],["😅","sweat"],
      ["🤣","rofl"],["😂","joy"],["🙂","slight"],["🙃","upside"],["😉","wink"],["😊","blush"],
      ["😇","angel"],["🥰","love"],["😍","heart eyes"],["🤩","star"],["😘","kiss"],["😗","kissing"],
      ["😋","yum"],["😛","tongue"],["😜","wink tongue"],["🤪","zany"],["🤨","raised brow"],["🧐","monocle"],
      ["🤓","nerd"],["😎","cool"],["🥳","party"],["😏","smirk"],["😒","unamused"],["😞","disappoint"],
      ["😔","pensive"],["😟","worried"],["😕","confused"],["🙁","frown"],["☹️","sad"],["😣","persevere"],
      ["😖","confounded"],["😫","tired"],["😩","weary"],["🥺","pleading"],["😢","cry"],["😭","sob"],
      ["😤","triumph"],["😠","angry"],["😡","rage"],["🤬","cursing"],["🤯","mind blown"],["😳","flushed"],
      ["🥵","hot"],["🥶","cold"],["😱","scream"],["😨","fearful"],["😰","anxious"],["😥","sweat sad"],
      ["🤗","hug"],["🤔","think"],["🤭","oops"],["🤫","shush"],["🤥","lie"],["😶","mute"],
      ["😐","neutral"],["😑","expressionless"],["😬","grimace"],["🙄","eyeroll"],["😯","hushed"],["😦","frowning"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Pessoas e Mãos",
    icons: [
      ["👋","wave"],["🤚","stop"],["🖐️","hand"],["✋","raise"],["🖖","spock"],["👌","ok"],
      ["🤌","pinch"],["🤏","pinching"],["✌️","peace"],["🤞","cross"],["🤟","love you"],["🤘","rock"],
      ["🤙","call"],["👈","left"],["👉","right"],["👆","up"],["👇","down"],["☝️","one"],
      ["👍","thumbs up"],["👎","thumbs down"],["✊","fist"],["👊","punch"],["🤛","left punch"],["🤜","right punch"],
      ["👏","clap"],["🙌","raise both"],["👐","open"],["🤲","palms"],["🤝","handshake"],["🙏","pray"],
      ["💪","muscle"],["🧠","brain"],["👀","eyes"],["👤","person"],["👥","people"],["🧑","adult"],
      ["👶","baby"],["🧒","child"],["👦","boy"],["👧","girl"],["👨","man"],["👩","woman"],
      ["🧓","elder"],["👴","old man"],["👵","old woman"],["💼","briefcase"],["🎓","graduate"],["👮","police"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Natureza",
    icons: [
      ["🐶","dog"],["🐱","cat"],["🐭","mouse"],["🐹","hamster"],["🐰","rabbit"],["🦊","fox"],
      ["🐻","bear"],["🐼","panda"],["🐨","koala"],["🐯","tiger"],["🦁","lion"],["🐮","cow"],
      ["🐷","pig"],["🐸","frog"],["🐵","monkey"],["🦄","unicorn"],["🐝","bee"],["🐛","bug"],
      ["🦋","butterfly"],["🐢","turtle"],["🐍","snake"],["🦖","dino"],["🐙","octopus"],["🦑","squid"],
      ["🦀","crab"],["🐠","fish"],["🐳","whale"],["🐬","dolphin"],["🦈","shark"],["🐊","croc"],
      ["🌵","cactus"],["🌲","tree"],["🌳","tree2"],["🌴","palm"],["🌱","seed"],["🌿","herb"],
      ["☘️","clover"],["🍀","luck"],["🎋","bamboo"],["🍃","leaf"],["🌺","flower"],["🌻","sun flower"],
      ["🌹","rose"],["🌷","tulip"],["🌸","blossom"],["💐","bouquet"],["🌍","earth"],["🌎","earth2"],
      ["🌏","earth3"],["🌕","moon"],["🌙","crescent"],["⭐","star"],["🌟","glow"],["✨","sparkles"],
      ["☀️","sunny"],["🌤️","sun cloud"],["⛅","cloud"],["🌧️","rain"],["⛈️","storm"],["🌈","rainbow"],
      ["❄️","snow"],["🔥","fire"],["💧","drop"],["🌊","wave"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Comida",
    icons: [
      ["🍎","apple"],["🍐","pear"],["🍊","orange"],["🍋","lemon"],["🍌","banana"],["🍉","watermelon"],
      ["🍇","grapes"],["🍓","strawberry"],["🫐","blueberry"],["🍒","cherry"],["🍑","peach"],["🥭","mango"],
      ["🍍","pineapple"],["🥥","coconut"],["🥝","kiwi"],["🍅","tomato"],["🥑","avocado"],["🥦","broccoli"],
      ["🥕","carrot"],["🌽","corn"],["🥔","potato"],["🍞","bread"],["🥖","baguette"],["🥐","croissant"],
      ["🧀","cheese"],["🥚","egg"],["🍳","cook"],["🥞","pancake"],["🧇","waffle"],["🥓","bacon"],
      ["🍔","burger"],["🍟","fries"],["🍕","pizza"],["🌭","hotdog"],["🥪","sandwich"],["🌮","taco"],
      ["🌯","burrito"],["🥙","wrap"],["🥗","salad"],["🍝","pasta"],["🍜","ramen"],["🍣","sushi"],
      ["🍱","bento"],["🍚","rice"],["🍰","cake"],["🎂","birthday"],["🧁","cupcake"],["🍪","cookie"],
      ["🍫","chocolate"],["🍿","popcorn"],["🍩","donut"],["☕","coffee"],["🍵","tea"],["🥤","drink"],
      ["🍺","beer"],["🍷","wine"],["🍹","cocktail"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Atividades",
    icons: [
      ["⚽","soccer"],["🏀","basket"],["🏈","football"],["⚾","baseball"],["🎾","tennis"],["🏐","volley"],
      ["🏉","rugby"],["🎱","pool"],["🏓","pingpong"],["🏸","badminton"],["🥅","goal"],["🏒","hockey"],
      ["🥊","box"],["🥋","martial"],["⛳","golf"],["🏹","archery"],["🎣","fishing"],["🤿","dive"],
      ["🎽","run"],["🛹","skate"],["🛼","roller"],["🎿","ski"],["🏂","snowboard"],["🏄","surf"],
      ["🏊","swim"],["🚴","bike"],["🎮","game"],["🕹️","joystick"],["🎲","dice"],["🎯","target"],
      ["🎳","bowling"],["🎤","mic"],["🎧","headphone"],["🎼","score"],["🎵","note"],["🎶","music"],
      ["🎷","sax"],["🎸","guitar"],["🎹","piano"],["🥁","drums"],["🎺","trumpet"],["🎻","violin"],
      ["🪕","banjo"],["🎬","movie"],["🎨","art"],["🎭","theatre"],["🎟️","ticket"],["🎪","circus"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Objetos",
    icons: [
      ["📱","phone"],["💻","laptop"],["⌨️","keyboard"],["🖥️","desktop"],["🖨️","printer"],["🖱️","mouse"],
      ["💾","disk"],["💿","cd"],["📀","dvd"],["📷","camera"],["📹","video"],["🎥","film"],
      ["📺","tv"],["📻","radio"],["🎙️","studio mic"],["⏰","alarm"],["⏱️","stopwatch"],["⌚","watch"],
      ["📡","antenna"],["🔋","battery"],["🔌","plug"],["💡","idea"],["🔦","flash"],["🕯️","candle"],
      ["🪔","lamp"],["📔","notebook"],["📕","book"],["📗","green book"],["📘","blue book"],["📙","orange book"],
      ["📚","books"],["📓","note"],["📒","ledger"],["📃","page"],["📜","scroll"],["📄","doc"],
      ["📰","news"],["🗞️","paper"],["📑","bookmark tabs"],["🔖","bookmark"],["🏷️","tag"],["💰","money"],
      ["💴","yen"],["💵","dollar"],["💶","euro"],["💷","pound"],["💳","card"],["💎","gem"],
      ["⚖️","balance"],["🔧","wrench"],["🔨","hammer"],["⚒️","tools"],["🛠️","tools2"],["⛏️","pick"],
      ["🪛","screwdriver"],["🔩","screw"],["⚙️","gear"],["🧱","brick"],["⛓️","chain"],["🧰","toolbox"],
      ["🧲","magnet"],["🔫","gun"],["💣","bomb"],["🧨","dynamite"],["🪓","axe"],["🛡️","shield"],
      ["🔑","key"],["🗝️","old key"],["🚪","door"],["🛋️","sofa"],["🛏️","bed"],["🚿","shower"],
      ["🛁","bath"],["🚽","toilet"],["🧴","lotion"],["🧷","pin"],["🧹","broom"],["🧺","basket2"],
      ["🧻","tp"],["🧼","soap"],["🧽","sponge"],["🪣","bucket"],["📦","package"],["📫","mail"],
      ["📮","post"],["✉️","envelope"],["📧","email"],["📨","incoming"],["📤","outbox"],["📥","inbox"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Símbolos",
    icons: [
      ["❤️","heart"],["🧡","orange"],["💛","yellow"],["💚","green"],["💙","blue"],["💜","purple"],
      ["🖤","black"],["🤍","white"],["🤎","brown"],["💔","broken"],["❣️","exclamation"],["💕","two hearts"],
      ["💞","revolving"],["💓","beating"],["💗","growing"],["💖","sparkle heart"],["💘","arrow"],["💝","gift heart"],
      ["✅","check"],["☑️","ballot"],["✔️","check2"],["❌","x"],["❎","x box"],["⭕","circle"],
      ["❗","exclamation"],["❓","question"],["❕","grey ex"],["❔","grey q"],["⚠️","warn"],["🚫","ban"],
      ["♻️","recycle"],["⚜️","fleur"],["🔱","trident"],["🆗","ok2"],["🆕","new"],["🆒","cool2"],
      ["🆓","free"],["🔝","top"],["🔜","soon"],["🔙","back"],["🔛","on"],["🔚","end"],
      ["⏩","fast forward"],["⏪","rewind"],["⏫","fast up"],["⏬","fast down"],["▶️","play"],["◀️","reverse"],
      ["🔼","up small"],["🔽","down small"],["⏸️","pause"],["⏹️","stop"],["⏺️","record"],["⏭️","next track"],
      ["⏮️","prev track"],["🎯","bullseye"],["🔱","trident"],["⚓","anchor"],["🧿","evil"],["☯️","yin"],
      ["☮️","peace2"],["✝️","cross"],["☪️","star moon"],["🕉️","om"],["✡️","star david"],["☸️","wheel"],
      ["🔆","high"],["🔅","low"],["🔔","bell"],["🔕","mute2"],["📣","mega"],["📢","loud"],
    ].map(([e,k]) => ({ e, k })),
  },
  {
    name: "Trabalho",
    icons: [
      ["📄","doc"],["📊","chart"],["📈","up chart"],["📉","down chart"],["📋","clipboard"],["📌","pin"],
      ["📍","loc"],["🗂️","folders"],["📁","folder"],["📂","open folder"],["🗃️","cards"],["🗄️","cabinet"],
      ["🗒️","spiral"],["🗓️","calendar"],["📅","date"],["📆","tear off"],["🕐","clock"],["⏳","hourglass"],
      ["⌛","sand"],["🎯","target"],["🚀","rocket"],["💼","work"],["🏢","office"],["🏛️","building"],
      ["🏦","bank"],["🏪","store"],["🏫","school"],["🏥","hospital"],["⛪","church"],["🕌","mosque"],
      ["🛕","temple"],["🕍","syn"],["💒","wedding"],["⛺","tent"],["🏕️","camp"],["🏔️","mountain"],
    ].map(([e,k]) => ({ e, k })),
  },
];

const ALL = GROUPS.flatMap(g => g.icons);

export function IconPicker({
  value, onChange, children, allowRemove = true,
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
  children: React.ReactNode;
  allowRemove?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return null;
    const s = q.toLowerCase();
    return ALL.filter(i => i.k.includes(s) || i.e.includes(s));
  }, [q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar ícone..."
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-72 overflow-y-auto pr-1">
          {filtered ? (
            <div className="grid grid-cols-8 gap-1">
              {filtered.length === 0 && (
                <p className="col-span-8 text-xs text-muted-foreground text-center py-4">Nada encontrado.</p>
              )}
              {filtered.map((i, idx) => (
                <button key={idx} type="button"
                  onClick={() => { onChange(i.e); setOpen(false); }}
                  className="text-xl h-8 w-8 rounded hover:bg-accent grid place-items-center">
                  {i.e}
                </button>
              ))}
            </div>
          ) : (
            GROUPS.map((g) => (
              <div key={g.name} className="mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1">{g.name}</p>
                <div className="grid grid-cols-8 gap-1">
                  {g.icons.map((i, idx) => (
                    <button key={idx} type="button"
                      onClick={() => { onChange(i.e); setOpen(false); }}
                      className="text-xl h-8 w-8 rounded hover:bg-accent grid place-items-center">
                      {i.e}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        {allowRemove && value && (
          <div className="pt-2 border-t border-border/50 mt-1">
            <Button variant="ghost" size="sm" className="w-full text-xs"
              onClick={() => { onChange(null); setOpen(false); }}>
              Remover ícone
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
