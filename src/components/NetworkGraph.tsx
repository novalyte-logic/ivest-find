import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Investor } from '../data/investors';

interface NetworkGraphProps {
  investors: Investor[];
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  name: string;
  type: 'investor' | 'focus' | 'firm';
  radius: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
}

export function NetworkGraph({ investors }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    const nodes: Node[] = [];
    const links: Link[] = [];
    const focusMap = new Map<string, string>(); // Focus Area -> Node ID
    const firmMap = new Map<string, string>(); // Firm -> Node ID

    // 1. Create Investor Nodes
    investors.forEach(inv => {
      nodes.push({
        id: inv.id,
        group: 1,
        name: inv.name,
        type: 'investor',
        radius: 8
      });

      // 2. Create Focus Area Nodes & Links
      inv.focus.forEach(focus => {
        if (!focusMap.has(focus)) {
          const focusId = `focus-${focus}`;
          focusMap.set(focus, focusId);
          nodes.push({
            id: focusId,
            group: 2,
            name: focus,
            type: 'focus',
            radius: 5
          });
        }
        links.push({
          source: inv.id,
          target: focusMap.get(focus)!,
          value: 1
        });
      });

      // 3. Create Firm Nodes & Links
      if (inv.firm) {
        if (!firmMap.has(inv.firm)) {
          const firmId = `firm-${inv.firm}`;
          firmMap.set(inv.firm, firmId);
          nodes.push({
            id: firmId,
            group: 3,
            name: inv.firm,
            type: 'firm',
            radius: 6
          });
        }
        links.push({
          source: inv.id,
          target: firmMap.get(inv.firm)!,
          value: 2
        });
      }
    });

    return { nodes, links };
  }, [investors]);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = 400; // Fixed height for the widget

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(50))
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 2));

    const link = svg.append("g")
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value));

    const node = svg.append("g")
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => {
        if (d.type === 'investor') return '#3b82f6'; // Blue
        if (d.type === 'focus') return '#a855f7'; // Purple
        return '#10b981'; // Green (Firm)
      })
      .call(drag(simulation as d3.Simulation<Node, undefined>) as any);

    node.append("title")
      .text((d) => d.name);

    // Add labels for larger nodes only to avoid clutter
    const label = svg.append("g")
      .selectAll("text")
      .data(data.nodes.filter(n => n.type !== 'focus')) 
      .join("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .text((d) => d.name)
      .attr("fill", "#666")
      .style("font-size", "10px")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
        
      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    function drag(simulation: d3.Simulation<Node, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data]);

  return (
    <div className="w-full h-[400px] bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Network Graph</h3>
        <div className="flex gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-zinc-500">Investor</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span className="text-zinc-500">Focus Area</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-zinc-500">Firm</span></div>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
}
