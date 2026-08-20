/**
 * Ready-made sections. Each block is a plain node spec that `createNode`
 * expands, so a block is exactly as editable as anything hand-placed --
 * there is no such thing as a locked "widget" here.
 */

const PHOTO = {
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&q=80',
  desk: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1400&q=80',
  city: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1400&q=80',
  cafe: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1400&q=80',
  product: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&q=80',
  portrait: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
}

const heading = (text, level = 'h2', styles) => ({ type: 'heading', props: { text, level }, styles })
const text = (t, styles) => ({ type: 'text', props: { text: t }, styles })
const button = (t, extra = {}) => ({ type: 'button', props: { text: t, action: 'link', href: '#', ...extra.props }, styles: extra.styles })
const icon = (name, styles) => ({ type: 'icon', props: { icon: name }, styles })

const ghostButton = (t) => ({
  type: 'button',
  name: 'Secondary button',
  props: { text: t, action: 'link', href: '#' },
  styles: {
    base: {
      backgroundColor: 'transparent', color: 'var(--color-text)',
      borderWidth: '1px', borderColor: 'var(--color-border)',
    },
    hover: { backgroundColor: 'var(--color-primary-soft)', borderColor: 'var(--color-primary)' },
  },
})

const centered = { base: { textAlign: 'center', maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' } }

const featureCard = (iconName, title, body) => ({
  type: 'card',
  name: 'Feature',
  children: [
    icon(iconName, { base: { width: '32px', height: '32px' } }),
    heading(title, 'h3', { base: { fontSize: '19px', fontWeight: '600' } }),
    text(body, { base: { fontSize: '15px' } }),
  ],
})

export const BLOCKS = [
  {
    id: 'navbar', label: 'Navigation bar', category: 'Top of page',
    hint: 'Logo on the left, links and a button on the right.',
    sketch: ['row:logo,spacer,link,link,button'],
    build: () => ({
      type: 'section',
      name: 'Navbar',
      styles: {
        base: {
          paddingTop: '18px', paddingBottom: '18px', position: 'sticky', top: '0px', zIndex: '50',
          backgroundColor: 'var(--color-bg)', borderBottomWidth: '1px', borderBottomStyle: 'solid',
          borderBottomColor: 'var(--color-border)',
        },
      },
      children: [{
        type: 'container',
        styles: { base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '20px' } },
        children: [
          {
            type: 'row', name: 'Brand', styles: { base: { gap: '10px' }, mobile: { flexDirection: 'row' } },
            children: [
              icon('layers', { base: { width: '24px', height: '24px' } }),
              heading('Northwind', 'h3', { base: { fontSize: '19px', fontWeight: '700', letterSpacing: '-0.01em' } }),
            ],
          },
          {
            type: 'row', name: 'Menu', styles: { base: { gap: '28px' }, mobile: { display: 'none' } },
            children: [
              { type: 'link', props: { text: 'Features', href: '#features' }, styles: { base: { color: 'var(--color-muted)', fontSize: '15px' } } },
              { type: 'link', props: { text: 'Pricing', href: '#pricing' }, styles: { base: { color: 'var(--color-muted)', fontSize: '15px' } } },
              { type: 'link', props: { text: 'About', href: '#about' }, styles: { base: { color: 'var(--color-muted)', fontSize: '15px' } } },
              button('Get started', { styles: { base: { paddingTop: '10px', paddingBottom: '10px', paddingLeft: '18px', paddingRight: '18px', fontSize: '14px' } } }),
            ],
          },
        ],
      }],
    }),
  },

  {
    id: 'hero', label: 'Hero, centred', category: 'Top of page',
    hint: 'A big promise, a sentence, and two buttons.',
    sketch: ['badge', 'title', 'text', 'row:button,button', 'image'],
    build: () => ({
      type: 'section',
      name: 'Hero',
      props: { htmlId: 'top' },
      styles: { base: { paddingTop: '96px', paddingBottom: '96px', gap: '20px' } },
      children: [
        { type: 'badge', props: { text: 'Now in open beta' } },
        heading('Build the thing you keep describing', 'h1', {
          base: { fontSize: '60px', textAlign: 'center', maxWidth: '860px' },
          mobile: { fontSize: '36px' },
        }),
        text('Drag, drop and publish. No code needed to start, and real code waiting when you want it.', {
          base: { fontSize: '19px', textAlign: 'center', maxWidth: '620px' },
        }),
        {
          type: 'row', name: 'Actions', styles: { base: { gap: '12px', marginTop: '8px', justifyContent: 'center' } },
          children: [button('Start building free'), ghostButton('See how it works')],
        },
        {
          type: 'image', name: 'Screenshot', props: { src: PHOTO.desk, alt: 'The product in use' },
          styles: { base: { maxWidth: '960px', marginTop: '32px', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)', borderRadius: '18px' } },
        },
      ],
    }),
  },

  {
    id: 'hero-split', label: 'Hero, side by side', category: 'Top of page',
    hint: 'Words on one side, a picture on the other.',
    sketch: ['cols:2'],
    build: () => ({
      type: 'section',
      name: 'Hero split',
      styles: { base: { paddingTop: '88px', paddingBottom: '88px' } },
      children: [{
        type: 'container',
        styles: { base: { flexDirection: 'row', alignItems: 'center', gap: '56px' }, mobile: { flexDirection: 'column' } },
        children: [
          {
            type: 'stack', name: 'Copy', styles: { base: { gap: '20px', flex: '1' } },
            children: [
              { type: 'badge', props: { text: 'For small teams' } },
              heading('Everything in one calm place', 'h1', { base: { fontSize: '52px' }, mobile: { fontSize: '34px' } }),
              text('Stop juggling five tools. Plan, build and ship from a single screen your whole team understands.'),
              { type: 'row', styles: { base: { gap: '12px', marginTop: '8px' } }, children: [button('Try it free'), ghostButton('Book a demo')] },
            ],
          },
          {
            type: 'image', props: { src: PHOTO.cafe, alt: 'People collaborating' },
            styles: { base: { flex: '1', borderRadius: '18px', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.14)' } },
          },
        ],
      }],
    }),
  },

  {
    id: 'features', label: 'Feature grid', category: 'Middle',
    hint: 'Three or six things you do well.',
    sketch: ['title', 'cols:3'],
    build: () => ({
      type: 'section',
      name: 'Features',
      props: { htmlId: 'features' },
      children: [{
        type: 'container',
        children: [
          { type: 'stack', styles: centered, children: [
            heading('Everything you need, nothing you do not'),
            text('Each piece is simple on its own. Together they cover the whole job.', { base: { fontSize: '17px' } }),
          ] },
          {
            type: 'grid', styles: { base: { marginTop: '20px' } },
            children: [
              featureCard('zap', 'Fast to start', 'Pick a template and make it yours in an afternoon.'),
              featureCard('shield', 'Safe by default', 'Your work is saved automatically as you go.'),
              featureCard('code', 'Real code inside', 'Open the code panel any time. Export whenever you like.'),
              featureCard('users', 'Made for teams', 'Share a link and collect feedback in one place.'),
              featureCard('trending-up', 'Grows with you', 'Start with a page, end with a full site.'),
              featureCard('smile', 'Genuinely friendly', 'Plain language everywhere. No jargon, no manuals.'),
            ],
          },
        ],
      }],
    }),
  },

  {
    id: 'steps', label: 'How it works', category: 'Middle',
    hint: 'Three numbered steps.',
    sketch: ['title', 'cols:3'],
    build: () => ({
      type: 'section',
      name: 'How it works',
      styles: { base: { backgroundColor: 'var(--color-primary-soft)' } },
      children: [{
        type: 'container',
        children: [
          { type: 'stack', styles: centered, children: [heading('Three steps and you are live')] },
          {
            type: 'grid',
            children: [1, 2, 3].map((n) => ({
              type: 'stack', name: `Step ${n}`, styles: { base: { gap: '10px' } },
              children: [
                { type: 'badge', props: { text: String(n) }, styles: { base: { width: '38px', height: '38px', justifyContent: 'center', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '16px', padding: '0px' } } },
                heading(['Pick a starting point', 'Make it yours', 'Publish it'][n - 1], 'h3', { base: { fontSize: '20px' } }),
                text([
                  'Choose a template or start from an empty page.',
                  'Change the words, colours and pictures by clicking them.',
                  'Export your site, or hand the code to a developer.',
                ][n - 1], { base: { fontSize: '15px' } }),
              ],
            })),
          },
        ],
      }],
    }),
  },

  {
    id: 'stats', label: 'Numbers', category: 'Middle',
    hint: 'Big numbers that build trust.',
    sketch: ['cols:4'],
    build: () => ({
      type: 'section',
      name: 'Numbers',
      styles: { base: { paddingTop: '56px', paddingBottom: '56px' } },
      children: [{
        type: 'container',
        children: [{
          type: 'grid',
          styles: { base: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }, mobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
          children: [
            ['12,000+', 'Projects built'], ['4.9/5', 'Average rating'],
            ['38 min', 'To first publish'], ['99.9%', 'Uptime last year'],
          ].map(([big, small]) => ({
            type: 'stack', name: 'Stat', styles: { base: { gap: '4px', alignItems: 'center' } },
            children: [
              heading(big, 'h3', { base: { fontSize: '38px', fontWeight: '700', color: 'var(--color-primary)' } }),
              text(small, { base: { fontSize: '14px', textAlign: 'center' } }),
            ],
          })),
        }],
      }],
    }),
  },

  {
    id: 'split-feature', label: 'Picture and words', category: 'Middle',
    hint: 'One idea explained beside an image.',
    sketch: ['cols:2'],
    build: () => ({
      type: 'section',
      name: 'Detail',
      children: [{
        type: 'container',
        styles: { base: { flexDirection: 'row', alignItems: 'center', gap: '56px' }, mobile: { flexDirection: 'column' } },
        children: [
          { type: 'image', props: { src: PHOTO.product, alt: 'A close look at the product' }, styles: { base: { flex: '1' } } },
          {
            type: 'stack', styles: { base: { flex: '1', gap: '16px' } },
            children: [
              heading('See exactly what you are making'),
              text('The canvas shows the finished thing, not a rough approximation. What you arrange is what your visitors get.'),
              { type: 'list' },
              { type: 'link', props: { text: 'Read the guide', href: '#' } },
            ],
          },
        ],
      }],
    }),
  },

  {
    id: 'testimonial', label: 'Quote', category: 'Middle',
    hint: 'A kind word from a customer.',
    sketch: ['quote', 'row:avatar,text'],
    build: () => ({
      type: 'section',
      name: 'Testimonial',
      styles: { base: { backgroundColor: 'var(--color-surface)' } },
      children: [{
        type: 'container',
        styles: { base: { maxWidth: '760px', alignItems: 'center', gap: '24px' } },
        children: [
          { type: 'quote', props: { text: 'I put our whole site together on a Sunday. My developer opened the exported code on Monday and said it was cleaner than ours.' }, styles: { base: { fontSize: '26px', borderLeftWidth: '0px', paddingLeft: '0px', textAlign: 'center' } } },
          {
            type: 'row', styles: { base: { gap: '12px', justifyContent: 'center' }, mobile: { flexDirection: 'row', justifyContent: 'center' } },
            children: [
              { type: 'image', name: 'Avatar', props: { src: PHOTO.portrait, alt: 'Customer portrait' }, styles: { base: { width: '44px', height: '44px', borderRadius: '999px' } } },
              { type: 'stack', styles: { base: { gap: '0px', width: 'auto' } }, children: [
                text('Priya Raman', { base: { fontWeight: '600', color: 'var(--color-text)', fontSize: '15px' } }),
                text('Founder, Meridian', { base: { fontSize: '14px' } }),
              ] },
            ],
          },
        ],
      }],
    }),
  },

  {
    id: 'pricing', label: 'Pricing table', category: 'Middle',
    hint: 'Three plans, with the middle one highlighted.',
    sketch: ['title', 'cols:3'],
    build: () => ({
      type: 'section',
      name: 'Pricing',
      props: { htmlId: 'pricing' },
      children: [{
        type: 'container',
        children: [
          { type: 'stack', styles: centered, children: [
            heading('Simple pricing'),
            text('Start free. Upgrade when it earns its keep.', { base: { fontSize: '17px' } }),
          ] },
          {
            type: 'grid', styles: { base: { marginTop: '20px', alignItems: 'stretch' } },
            children: [
              ['Starter', '$0', 'For trying things out', false],
              ['Pro', '$19', 'For growing projects', true],
              ['Team', '$49', 'For working together', false],
            ].map(([name, price, blurb, featured]) => ({
              type: 'card',
              name: `${name} plan`,
              styles: featured
                ? { base: { borderColor: 'var(--color-primary)', borderWidth: '2px', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.10)', gap: '14px' } }
                : { base: { gap: '14px' } },
              children: [
                ...(featured ? [{ type: 'badge', props: { text: 'Most popular' } }] : []),
                heading(name, 'h3', { base: { fontSize: '18px', fontWeight: '600' } }),
                { type: 'row', styles: { base: { gap: '6px', alignItems: 'baseline' } }, children: [
                  heading(price, 'h3', { base: { fontSize: '42px', fontWeight: '700' } }),
                  text('/ month', { base: { fontSize: '14px' } }),
                ] },
                text(blurb, { base: { fontSize: '15px' } }),
                { type: 'divider' },
                { type: 'list', styles: { base: { gap: '8px' } } },
                featured ? button('Choose Pro', { styles: { base: { width: '100%', marginTop: 'auto' } } })
                  : { ...ghostButton(`Choose ${name}`), styles: { base: { width: '100%', marginTop: 'auto', backgroundColor: 'transparent', color: 'var(--color-text)', borderWidth: '1px', borderColor: 'var(--color-border)' } } },
              ],
            })),
          },
        ],
      }],
    }),
  },

  {
    id: 'logos', label: 'Logo strip', category: 'Middle',
    hint: 'A quiet row of names that trust you.',
    sketch: ['row:logo,logo,logo,logo,logo'],
    build: () => ({
      type: 'section',
      name: 'Trusted by',
      styles: { base: { paddingTop: '40px', paddingBottom: '40px' } },
      children: [{
        type: 'container',
        styles: { base: { gap: '20px', alignItems: 'center' } },
        children: [
          text('Trusted by teams at', { base: { fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' } }),
          {
            type: 'row',
            styles: { base: { gap: '40px', justifyContent: 'center', opacity: '0.6', flexWrap: 'wrap' }, mobile: { flexDirection: 'row' } },
            children: ['Meridian', 'Foldline', 'Northwind', 'Casper & Co', 'Riverbend'].map((n) =>
              heading(n, 'h4', { base: { fontSize: '18px', fontWeight: '600' } })),
          },
        ],
      }],
    }),
  },

  {
    id: 'gallery', label: 'Picture gallery', category: 'Middle',
    hint: 'A grid of images.',
    sketch: ['cols:3'],
    build: () => ({
      type: 'section',
      name: 'Gallery',
      children: [{
        type: 'container',
        children: [
          heading('Recent work', 'h2', centered),
          {
            type: 'grid', styles: { base: { gap: '16px' } },
            children: [PHOTO.city, PHOTO.cafe, PHOTO.desk, PHOTO.product, PHOTO.team, PHOTO.city].map((src, i) => ({
              type: 'image', name: `Photo ${i + 1}`, props: { src, alt: 'Gallery image' },
              styles: { base: { height: '240px', objectFit: 'cover' } },
            })),
          },
        ],
      }],
    }),
  },

  {
    id: 'team', label: 'The team', category: 'Middle',
    hint: 'Faces and roles.',
    sketch: ['title', 'cols:4'],
    build: () => ({
      type: 'section',
      name: 'Team',
      props: { htmlId: 'about' },
      children: [{
        type: 'container',
        children: [
          heading('The people behind it', 'h2', centered),
          {
            type: 'grid',
            styles: { base: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }, mobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            children: [
              ['Priya Raman', 'Founder'], ['Tom Alder', 'Design'],
              ['Nina Okafor', 'Engineering'], ['Sam Ellis', 'Support'],
            ].map(([name, role]) => ({
              type: 'stack', name, styles: { base: { gap: '10px', alignItems: 'center' } },
              children: [
                { type: 'image', props: { src: PHOTO.portrait, alt: name }, styles: { base: { width: '92px', height: '92px', borderRadius: '999px' } } },
                heading(name, 'h4', { base: { fontSize: '16px', fontWeight: '600', textAlign: 'center' } }),
                text(role, { base: { fontSize: '14px', textAlign: 'center' } }),
              ],
            })),
          },
        ],
      }],
    }),
  },

  {
    id: 'faq', label: 'Questions', category: 'Middle',
    hint: 'Answers to what people always ask.',
    sketch: ['title', 'text', 'text', 'text'],
    build: () => ({
      type: 'section',
      name: 'FAQ',
      children: [{
        type: 'container',
        styles: { base: { maxWidth: '760px' } },
        children: [
          heading('Common questions', 'h2', centered),
          {
            type: 'stack', styles: { base: { gap: '0px', marginTop: '12px' } },
            children: [
              ['Do I need to know how to code?', 'No. Everything is done by clicking and typing. The code is there if you ever want it.'],
              ['Can I export what I make?', 'Yes -- a complete website or a React project, downloaded as a zip file.'],
              ['Does my work save automatically?', 'Yes, continuously in your browser. You can also download a backup file.'],
              ['Can a developer pick it up later?', 'That is the point. The exported code is ordinary HTML, CSS and React.'],
            ].map(([q, a]) => ({
              type: 'stack', name: 'Question',
              styles: { base: { gap: '6px', paddingTop: '20px', paddingBottom: '20px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'var(--color-border)' } },
              children: [heading(q, 'h4', { base: { fontSize: '17px', fontWeight: '600' } }), text(a, { base: { fontSize: '15px' } })],
            })),
          },
        ],
      }],
    }),
  },

  {
    id: 'cta', label: 'Call to action', category: 'Bottom',
    hint: 'One last nudge before the footer.',
    sketch: ['title', 'text', 'button'],
    build: () => ({
      type: 'section',
      name: 'Call to action',
      styles: { base: { backgroundColor: 'var(--color-primary)', paddingTop: '80px', paddingBottom: '80px' } },
      children: [{
        type: 'container',
        styles: { base: { alignItems: 'center', gap: '18px', maxWidth: '680px' } },
        children: [
          heading('Ready to build yours?', 'h2', { base: { color: '#ffffff', textAlign: 'center', fontSize: '40px' } }),
          text('It takes about ten minutes to get something you are proud to share.', { base: { color: 'rgba(255, 255, 255, 0.82)', textAlign: 'center', fontSize: '17px' } }),
          button('Start building free', { styles: { base: { backgroundColor: '#ffffff', color: 'var(--color-primary)', fontSize: '16px', paddingTop: '15px', paddingBottom: '15px', paddingLeft: '28px', paddingRight: '28px' } } }),
        ],
      }],
    }),
  },

  {
    id: 'contact', label: 'Contact form', category: 'Bottom',
    hint: 'Let people write to you.',
    sketch: ['cols:2'],
    build: () => ({
      type: 'section',
      name: 'Contact',
      props: { htmlId: 'contact' },
      children: [{
        type: 'container',
        styles: { base: { flexDirection: 'row', gap: '56px', alignItems: 'flex-start' }, mobile: { flexDirection: 'column' } },
        children: [
          {
            type: 'stack', styles: { base: { flex: '1', gap: '14px' } },
            children: [
              heading('Say hello'),
              text('We answer every message, usually within a day.'),
              { type: 'row', styles: { base: { gap: '10px' }, mobile: { flexDirection: 'row' } }, children: [icon('mail', { base: { width: '20px', height: '20px' } }), text('hello@example.com', { base: { fontSize: '15px' } })] },
              { type: 'row', styles: { base: { gap: '10px' }, mobile: { flexDirection: 'row' } }, children: [icon('map-pin', { base: { width: '20px', height: '20px' } }), text('12 Harbour Road, Bristol', { base: { fontSize: '15px' } })] },
            ],
          },
          {
            type: 'form', styles: { base: { flex: '1', maxWidth: 'none' } },
            children: [
              { type: 'label', props: { text: 'Your name' } },
              { type: 'input', props: { placeholder: 'Alex Morgan', inputType: 'text', name: 'name' } },
              { type: 'label', props: { text: 'Email address' } },
              { type: 'input', props: { placeholder: 'you@example.com', inputType: 'email', name: 'email' } },
              { type: 'label', props: { text: 'Message' } },
              { type: 'textarea' },
              { type: 'button', props: { text: 'Send message', action: 'submit' }, styles: { base: { width: '100%' } } },
            ],
          },
        ],
      }],
    }),
  },

  {
    id: 'newsletter', label: 'Email sign-up', category: 'Bottom',
    hint: 'Collect email addresses.',
    sketch: ['title', 'row:input,button'],
    build: () => ({
      type: 'section',
      name: 'Newsletter',
      styles: { base: { backgroundColor: 'var(--color-surface)' } },
      children: [{
        type: 'container',
        styles: { base: { alignItems: 'center', maxWidth: '620px', gap: '16px' } },
        children: [
          heading('Get the monthly note', 'h2', { base: { textAlign: 'center', fontSize: '32px' } }),
          text('One short email a month. Unsubscribe in a click.', { base: { textAlign: 'center' } }),
          {
            type: 'form',
            styles: { base: { flexDirection: 'row', maxWidth: '460px', gap: '10px' }, mobile: { flexDirection: 'column' } },
            children: [
              { type: 'input', styles: { base: { flex: '1' } } },
              { type: 'button', props: { text: 'Subscribe', action: 'submit' } },
            ],
          },
        ],
      }],
    }),
  },

  {
    id: 'footer', label: 'Footer', category: 'Bottom',
    hint: 'Links and small print at the very bottom.',
    sketch: ['cols:4', 'divider', 'row:text,link,link'],
    build: () => ({
      type: 'section',
      name: 'Footer',
      styles: { base: { paddingTop: '56px', paddingBottom: '40px', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'var(--color-border)' } },
      children: [{
        type: 'container',
        styles: { base: { gap: '32px' } },
        children: [
          {
            type: 'row',
            styles: { base: { alignItems: 'flex-start', justifyContent: 'space-between', gap: '40px' } },
            children: [
              {
                type: 'stack', name: 'Brand', styles: { base: { gap: '10px', maxWidth: '260px' } },
                children: [
                  { type: 'row', styles: { base: { gap: '8px' }, mobile: { flexDirection: 'row' } }, children: [icon('layers', { base: { width: '20px', height: '20px' } }), heading('Northwind', 'h4', { base: { fontSize: '17px', fontWeight: '700' } })] },
                  text('Careful work, delivered on time.', { base: { fontSize: '14px' } }),
                ],
              },
              ...[['Product', ['Features', 'Pricing', 'Changelog']], ['Company', ['About', 'Blog', 'Careers']], ['Help', ['Support', 'Privacy', 'Terms']]].map(([title, links]) => ({
                type: 'stack', name: title, styles: { base: { gap: '10px', width: 'auto' } },
                children: [
                  heading(title, 'h4', { base: { fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' } }),
                  ...links.map((l) => ({ type: 'link', props: { text: l, href: '#' }, styles: { base: { color: 'var(--color-muted)', fontSize: '14px' } } })),
                ],
              })),
            ],
          },
          { type: 'divider' },
          text('© 2026 Northwind. All rights reserved.', { base: { fontSize: '13px', textAlign: 'center' } }),
        ],
      }],
    }),
  },
]

export const BLOCK_CATEGORIES = ['Top of page', 'Middle', 'Bottom']

export const blockById = (id) => BLOCKS.find((b) => b.id === id)
