/**
 * Pre-computed hive demo data for the landing page.
 * 50 nodes total: 1 center + 5 tier-1 + 44 tier-2
 * Positions are deterministic and pre-computed — no physics or layout engine needed at runtime.
 */

export interface DemoNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  tier: number;
  label: string;
}

export interface DemoLink {
  sourceId: string;
  targetId: string;
  opacity: number;
}

// Color palette for tier-1 groups
const COLORS = [
  "rgba(107, 138, 255, {a})", // Blue
  "rgba(167, 139, 250, {a})", // Purple
  "rgba(94, 234, 212, {a})", // Teal
  "rgba(244, 114, 182, {a})", // Pink
  "rgba(251, 191, 36, {a})", // Amber
];

function color(index: number, alpha: number): string {
  return COLORS[index % COLORS.length]!.replace("{a}", alpha.toFixed(2));
}

// Simple deterministic hash
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h & 0x7fffffff) / 0x7fffffff;
}

// Pre-compute 50 nodes
function generateNodes(): DemoNode[] {
  const nodes: DemoNode[] = [];
  const OUTER = 200;

  // Center node
  nodes.push({
    id: "center",
    x: 0,
    y: 0,
    radius: 0,
    color: "rgba(255, 255, 255, 0.10)",
    tier: 0,
    label: "Your Content",
  });

  // 5 tier-1 category nodes
  const tier1Labels = [
    "Engagement",
    "Virality",
    "Audience",
    "Trends",
    "Revenue",
  ];
  const tier1: DemoNode[] = [];

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
    const r = OUTER * 0.2;
    const node: DemoNode = {
      id: `t1-${i}`,
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      radius: 7,
      color: color(i, 0.85),
      tier: 1,
      label: tier1Labels[i]!,
    };
    nodes.push(node);
    tier1.push(node);
  }

  // 44 tier-2 leaf nodes, clustered behind their parent
  const CONE_HALF = Math.PI * 0.28;
  const perGroup = [9, 9, 9, 9, 8]; // 44 total

  for (let g = 0; g < 5; g++) {
    const parent = tier1[g]!;
    const parentAngle = Math.atan2(parent.y, parent.x);
    const count = perGroup[g]!;

    for (let j = 0; j < count; j++) {
      const id = `t2-${g}-${j}`;
      const h = hash(id);
      const h2 = hash(id + "salt");
      const angleOffset = (h - 0.5) * 2 * CONE_HALF;
      const angle = parentAngle + angleOffset;
      const dist = OUTER * 0.1 + (OUTER * 0.45 * Math.sqrt((j + 0.5) / count) * 0.5 + h2 * 0.5);

      nodes.push({
        id,
        x: parent.x + dist * Math.cos(angle),
        y: parent.y + dist * Math.sin(angle),
        radius: 3 + h * 2,
        color: color(g, 0.3 + h * 0.4),
        tier: 2,
        label: "",
      });
    }
  }

  return nodes;
}

function generateLinks(nodes: DemoNode[]): DemoLink[] {
  const links: DemoLink[] = [];
  const tier1 = nodes.filter((n) => n.tier === 1);
  const tier2 = nodes.filter((n) => n.tier === 2);

  // Center → tier-1
  for (const t1 of tier1) {
    links.push({ sourceId: "center", targetId: t1.id, opacity: 0.15 });
  }

  // Tier-1 mesh
  for (let i = 0; i < tier1.length; i++) {
    for (let j = i + 1; j < tier1.length; j++) {
      links.push({
        sourceId: tier1[i]!.id,
        targetId: tier1[j]!.id,
        opacity: 0.08,
      });
    }
  }

  // Tier-1 → tier-2 (parent-child by group index)
  for (const t2 of tier2) {
    const groupIndex = parseInt(t2.id.split("-")[1]!);
    const parent = tier1[groupIndex];
    if (parent) {
      links.push({ sourceId: parent.id, targetId: t2.id, opacity: 0.06 });
    }
  }

  return links;
}

export const DEMO_NODES = generateNodes();
export const DEMO_LINKS = generateLinks(DEMO_NODES);
