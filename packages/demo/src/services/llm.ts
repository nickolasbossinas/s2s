/**
 * Mock LLM service.
 * "say long text" triggers a long random response; otherwise echoes input.
 * Replace this with a real Claude API call when ready.
 */

const longResponses = [
  `Here's a classic pancake recipe you can try this weekend. Start by mixing one and a half cups of all-purpose flour with three and a half teaspoons of baking powder and one tablespoon of sugar in a large bowl. Make a well in the center and pour in one and a quarter cups of milk, one egg, and three tablespoons of melted butter. Mix until the batter is smooth but don't overmix — a few lumps are perfectly fine. Heat a lightly oiled griddle or frying pan over medium-high heat. Pour roughly a quarter cup of batter onto the griddle for each pancake. Cook until bubbles form on the surface and the edges look dry, then flip and cook until browned on the other side. Serve hot with maple syrup, fresh berries, or a dusting of powdered sugar. You can also add chocolate chips or blueberries directly into the batter for extra flavor.`,

  `Let me tell you about the fascinating journey of coffee from bean to cup. Coffee plants are primarily grown in tropical regions along the equator, in countries like Brazil, Ethiopia, Colombia, and Vietnam. The cherries are harvested either by hand or machine, then processed using one of three methods: washed, natural, or honey. After processing, the green beans are dried and sorted by size and quality before being shipped to roasters around the world. Roasting transforms the chemical and physical properties of the beans, developing the complex flavors we associate with coffee. Light roasts preserve more of the bean's origin character, while dark roasts bring out smoky and chocolatey notes. Once roasted, the beans are ground and brewed using methods like pour-over, French press, espresso, or cold brew, each producing a distinctly different cup profile.`,

  `The octopus is one of nature's most remarkable creatures. With three hearts, blue blood, and eight flexible arms lined with suckers, they are truly alien-like beings living in our oceans. Their intelligence is extraordinary — they can solve mazes, open jars, and even use tools like coconut shells for shelter. Each arm contains roughly two-thirds of their neurons, meaning their arms can essentially think independently. Octopuses are masters of camouflage, capable of changing both color and texture in milliseconds to blend with their surroundings or communicate with other creatures. They have no bones whatsoever, allowing them to squeeze through openings barely larger than their eyeball. Most species live only one to two years, and tragically, they die shortly after reproducing. Despite their short lives, they display remarkable problem-solving abilities and curiosity that continues to amaze marine biologists and researchers around the world.`,

  `Building a mechanical keyboard from scratch is a rewarding hobby that has grown enormously in popularity. First you need to choose a layout — full size, tenkeyless, seventy-five percent, or sixty-five percent are the most common options. Next comes selecting switches, which determine how each keypress feels and sounds. Linear switches like Cherry MX Red offer a smooth keystroke, tactile switches like Holy Pandas provide a satisfying bump, and clicky switches like Box Jades add an audible click. The PCB is the brain of the keyboard, and many modern boards support hot-swap sockets so you can change switches without soldering. Stabilizers are essential for larger keys like the spacebar and shift keys — properly lubed stabilizers eliminate rattle and improve the overall sound profile. Keycaps come in various materials like ABS and PBT, with different profiles such as Cherry, SA, and MT3. Finally, adding foam between the PCB and case reduces hollowness and creates a deeper, more satisfying sound signature.`,
];

const isMocked = import.meta.env.VITE_MOCKED_RESPONSES === 'true';

export async function sendMessage(text: string): Promise<string> {
  if (isMocked) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (/say long text/i.test(text)) {
      return longResponses[Math.floor(Math.random() * longResponses.length)];
    }

    return `Echo: ${text}`;
  }

  // TODO: real LLM call
  return '';
}
