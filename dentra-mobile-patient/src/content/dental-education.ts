// Patient education content. Edit this file to change what the Dental Education screen shows: no component code needs
// to change. Keep it general and in plain words: this is information, never a diagnosis or a treatment recommendation.

export interface EducationArticle {
  id: string;
  title: string;
  /** One or two sentences shown on the card */
  summary: string;
  /** Paragraphs shown when the card is opened */
  body: string[];
  /** Short bullet points shown after the paragraphs */
  points?: string[];
  /** Editable booking reason. Custom reasons are prefilled under Other. */
  concern?: string;
  /** Shown with a warning style: signs that need quick professional care */
  urgent?: boolean;
  sources?: { title: string; url: string }[];
}

export interface EducationCategory {
  id: string;
  title: string;
  description: string;
  articles: EducationArticle[];
}

export const EDUCATION_DISCLAIMER =
  'This is general information to help you understand your teeth and gums. It is not a diagnosis and does not replace advice from a dentist who has examined you.';

export const EDUCATION: EducationCategory[] = [
  {
    id: 'conditions',
    title: 'Common dental conditions',
    description:
      'What these problems are, why they happen and what you may notice.',
    articles: [
      {
        id: 'cavities',
        title: 'Cavities and tooth decay',
        summary:
          'Soft spots or holes that form when germs in plaque turn sugar into acid that wears away the tooth.',
        body: [
          'Plaque is a sticky film of germs that builds up on teeth. When you eat or drink sugary or starchy things, these germs make acid that slowly damages the hard outer layer of the tooth. Over time this can become a hole, called a cavity.',
          'Early decay often causes no pain, which is why check-ups matter. A dentist can often fix small cavities with a simple filling. Left alone, decay can reach the nerve of the tooth and cause pain or infection.',
        ],
        points: [
          'You may notice white, brown or black spots on a tooth',
          'Sensitivity to sweet, hot or cold food and drinks',
          'Food getting stuck in one place, or a rough or sharp edge you can feel with your tongue',
        ],
        concern: 'Cavity / Tooth Decay',
      },
      {
        id: 'toothache',
        title: 'Toothache',
        summary:
          'Pain in or around a tooth. It has many possible causes, so it is best checked by a dentist.',
        body: [
          'A toothache can come from decay, a cracked tooth, an infected tooth, a gum problem, or sometimes from grinding your teeth. The pain may be sharp, dull, constant, or only when you bite or have something hot or cold.',
          'Rinsing with warm water and avoiding very hot, cold or hard food may be comfortable for a short time, but this does not treat the cause. Pain that lasts more than a day or two, or keeps coming back, should be looked at.',
        ],
        points: [
          'Pain that wakes you at night or is getting worse',
          'Pain with swelling, a bad taste or a pimple on the gum',
          'Pain when biting down',
        ],
        concern: 'Toothache',
      },
      {
        id: 'gum-disease',
        title: 'Gum disease',
        summary:
          'Red, swollen or bleeding gums caused by plaque along the gum line. Early gum disease can be reversed.',
        body: [
          'Gum disease starts as gingivitis: gums that look red or puffy and bleed when you brush or floss. With good cleaning at home and a professional clean, gums usually recover.',
          'If it is not treated it can spread deeper and damage the bone that holds teeth in place (periodontitis). This can make teeth loose over time. Smoking and diabetes make gum disease more likely and harder to control.',
        ],
        points: [
          'Gums that bleed when you brush or floss',
          'Persistent bad breath or a bad taste',
          'Gums that look like they are pulling away from the teeth, or teeth that feel loose',
        ],
        concern: 'Bleeding gums',
      },
      {
        id: 'missing-teeth',
        title: 'Missing teeth',
        summary:
          'Teeth can be lost to decay, gum disease or injury. There are several ways to replace them.',
        body: [
          'A gap can make chewing and speaking harder, and nearby teeth may slowly drift into the space. Replacing a missing tooth can help you eat comfortably and keep your bite steady.',
          'Common choices include dental implants, bridges and dentures. The right one depends on your mouth, your gums and your budget, which is something a dentist can discuss with you after an examination.',
        ],
        concern: 'Missing Tooth',
      },
    ],
  },
  {
    id: 'hygiene',
    title: 'Daily oral hygiene',
    description: 'Simple habits that keep teeth and gums healthy.',
    articles: [
      {
        id: 'brushing',
        sources: [
          {
            title: 'NHS: Keeping your teeth clean',
            url: 'https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/',
          },
        ],
        title: 'Brushing well',
        summary:
          'Twice a day, for two minutes, with a soft brush and fluoride toothpaste.',
        body: [
          'Brush before bed and at one other time each day. Use a soft toothbrush and fluoride toothpaste. Spit out the excess afterwards without rinsing straight away.',
        ],
        points: [
          'Hold the brush at a slight angle towards the gum line and use short, gentle strokes',
          'Clean the outside, inside and chewing surfaces of every tooth',
          'Brush gently: pressing hard does not clean better and can hurt your gums',
          'Replace your toothbrush every three months, or sooner if the bristles are bent',
        ],
      },
      {
        id: 'flossing',
        title: 'Cleaning between your teeth',
        summary:
          'A brush cannot reach the spaces between teeth. Floss or small interdental brushes can.',
        body: [
          'Cleaning between your teeth once a day removes plaque and food that brushing leaves behind. This is where cavities and gum problems often start.',
        ],
        points: [
          'Slide the floss gently between two teeth and curve it around each tooth in a C shape',
          'Move it up and down under the gum edge without snapping it',
          'Your gums may bleed a little at first. This usually settles within a week or two of daily cleaning. If it does not, mention it to your dentist',
        ],
      },
      {
        id: 'healthy-gums',
        title: 'Looking after your gums',
        summary:
          'Healthy gums are usually firm and do not bleed with normal brushing. Their natural colour can vary.',
        body: [
          'Good brushing and cleaning between teeth are the main ways to keep gums healthy. A professional clean now and then removes hard deposits (tartar) that cannot be brushed away.',
        ],
        points: [
          'Do not stop brushing where your gums bleed: gentle, regular cleaning helps them heal',
          'Avoid tobacco in any form, as it harms gums and slows healing',
          'Limit sugary snacks and drinks, and have them with meals rather than all day',
        ],
        concern: 'Bleeding gums',
      },
    ],
  },
  {
    id: 'prevention',
    title: 'Preventive care',
    description:
      'Catching small problems early is easier, cheaper and more comfortable.',
    articles: [
      {
        id: 'checkups',
        sources: [
          {
            title: 'NHS: Dental check-ups',
            url: 'https://www.nhs.uk/live-well/healthy-teeth-and-gums/dental-check-ups/',
          },
        ],
        title: 'Why routine check-ups matter',
        summary:
          'Your dentist recommends when to return based on your teeth, gums and risk of future problems.',
        body: [
          'At a check-up the dentist looks at your teeth, gums and mouth, and may take X-rays. Many problems, such as early cavities or gum disease, do not hurt at first, so you can only find them by looking.',
        ],
        concern: 'Check-up and cleaning',
      },
      {
        id: 'everyday-protection',
        title: 'Protecting your teeth every day',
        summary:
          'What you eat and drink, and how you protect your teeth, makes a big difference.',
        body: [],
        points: [
          'Choose water over sugary or fizzy drinks, and keep sweets to mealtimes',
          'Use fluoride toothpaste: fluoride makes teeth more resistant to decay',
          'Wear a mouthguard for contact sports, and avoid using teeth to open packets or crack hard things',
          'If you grind your teeth at night, ask a dentist about a night guard',
        ],
      },
    ],
  },
  {
    id: 'treatments',
    title: 'Common treatments',
    description: 'What the usual treatments are and what to generally expect.',
    articles: [
      {
        id: 'filling',
        sources: [
          {
            title: 'NHS: Dental treatments',
            url: 'https://www.nhs.uk/live-well/healthy-teeth-and-gums/dental-treatments/',
          },
          {
            title: 'Royal United Hospitals NHS: Dental aftercare',
            url: 'https://ruh.nhs.uk/patients/patient_information/ORL003_After_a_general_anaesthetic_for_special_care_dental_treatment.pdf',
          },
        ],
        title: 'Fillings',
        summary: 'A filling repairs a tooth damaged by a cavity.',
        body: [
          'The dentist repairs the damaged area using a filling material chosen for your tooth. Different materials are available; your dentist can explain the options.',
          'Teeth may feel different or sensitive after treatment. Follow the aftercare advice you are given, and contact your dentist if discomfort does not settle or your bite feels uncomfortable.',
        ],
        concern: 'Cavity / Tooth Decay',
      },
      {
        id: 'root-canal',
        title: 'Root canal treatment',
        summary:
          'Treatment that saves a tooth whose inner nerve tissue (the pulp) is infected or badly damaged.',
        body: [
          'The dentist numbs the tooth, cleans out the infected tissue inside it, and seals the space. The tooth is usually then covered with a crown to protect it. It may take more than one visit.',
          'The aim is to relieve pain and keep your own tooth instead of removing it. The treatment itself is done under numbing, and the tooth can be tender for a few days afterwards.',
        ],
        concern: 'Toothache',
      },
      {
        id: 'cleaning',
        title: 'Scaling and professional cleaning',
        summary:
          'Removing hard deposits (tartar) from the teeth and below the gum line.',
        body: [
          'A dentist or hygienist uses special instruments to remove tartar and polish the teeth. Your gums may feel tender or bleed a little afterwards, and teeth can feel sensitive for a day or two.',
        ],
        concern: 'Check-up and cleaning',
      },
      {
        id: 'replacing-teeth',
        title: 'Crowns, bridges, dentures and implants',
        summary: 'Ways to cover a weak tooth or replace missing ones.',
        body: [
          'A crown is a cap that covers and strengthens a damaged tooth. A bridge fills a gap by joining a false tooth to the teeth beside it. Dentures are removable false teeth. An implant is a small post placed in the jaw bone to hold a false tooth.',
          'Each option has different costs, care needs and waiting times. A dentist can explain which may suit you after examining your mouth.',
        ],
        concern: 'Missing Tooth',
      },
      {
        id: 'braces',
        title: 'Braces and aligners',
        summary:
          'Gently move teeth into a better position to improve how they look and fit together.',
        body: [
          'Braces use brackets and wires fixed to the teeth. Clear aligners are removable trays. Treatment usually takes many months, with regular visits to adjust it.',
          'Teeth can feel sore for a few days after each adjustment. Keeping teeth very clean matters even more while you wear braces.',
        ],
        concern: 'Braces or aligners',
      },
      {
        id: 'extraction',
        title: 'Tooth removal (extraction)',
        summary: 'Taking out a tooth that cannot be saved.',
        body: [
          "The area is numbed first. Afterwards, bite gently on the gauze you are given, avoid rinsing hard or using a straw for the first day, and follow your dentist's advice about food and medicines.",
        ],
        concern: 'Toothache',
      },
    ],
  },
  {
    id: 'when-to-seek-care',
    title: 'When to see a dentist',
    description:
      'Signs that deserve a consultation, and signs that need urgent care.',
    articles: [
      {
        id: 'book-a-consultation',
        title: 'Signs you should book a consultation',
        summary: 'Do not wait for these to go away on their own.',
        body: ['Book a visit soon if you notice any of these:'],
        points: [
          'Toothache or sensitivity that lasts more than a day or two',
          'Gums that bleed, hurt or look swollen',
          'A broken, chipped or loose tooth',
          'A hole, dark spot or rough edge on a tooth',
          'A sore, lump or white or red patch in your mouth that does not heal in about two weeks',
          'A missing tooth, or teeth that have become crooked or crowded',
          'You are overdue for the check-up interval recommended by your dentist',
        ],
        concern: 'Toothache',
      },
      {
        id: 'urgent-care',
        sources: [
          {
            title: 'NHS: Knocked-out tooth',
            url: 'https://www.nhs.uk/conditions/knocked-out-tooth/',
          },
          {
            title: 'NHS: Urgent and emergency dental care',
            url: 'https://www.nhs.uk/nhs-services/dentists/how-to-find-an-nhs-dentist-in-an-emergency/',
          },
          {
            title: 'NHS: Toothache',
            url: 'https://www.nhs.uk/symptoms/toothache/',
          },
        ],
        title: 'Signs that need urgent care',
        summary: 'Get help quickly if you notice these.',
        urgent: true,
        body: [
          'Get emergency medical help immediately if swelling makes it hard to breathe, swallow or speak, if swelling affects your eye or neck, or if you have heavy bleeding that will not stop or a serious injury to your face or jaw. Go to the nearest emergency department or call your local emergency number. Do not wait for an app booking.',
          'Contact an urgent dental service promptly for facial or gum swelling, especially with fever, or for severe pain or an injured tooth. A knocked-out adult tooth needs immediate dental attention.',
        ],
        points: [
          'Severe pain that medicines do not ease',
          'A knocked-out adult tooth: hold it by the crown, keep it moist in milk and seek an emergency dentist immediately. Do not put a baby tooth back in; get urgent dental advice',
          'Bleeding after dental treatment that does not stop: seek urgent help; heavy, uncontrolled bleeding needs emergency medical care',
          'A broken or displaced tooth after an injury',
        ],
      },
    ],
  },
];

export function findEducationArticle(id: string) {
  for (const category of EDUCATION) {
    const article = category.articles.find(item => item.id === id);
    if (article) return { article, category };
  }
  return undefined;
}

export const FEATURED_ARTICLE_IDS = ['brushing', 'flossing', 'checkups'];
