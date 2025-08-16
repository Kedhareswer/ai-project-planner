"use client"

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useResearchSession } from '@/components/research-session-provider'
import { getRecommendations } from '@/app/explorer/semantic-scholar'

interface NodeDatum {
  id: string
  title: string
}
interface LinkDatum {
  source: string
  target: string
}

export default function RelatedWorkGraph() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { getSelectedPapers } = useResearchSession()
  const papers = getSelectedPapers()

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 600,
      height = 400

    svg.attr('width', width).attr('height', height)

    const nodes: NodeDatum[] = papers.map(p => ({ id: p.id, title: p.title }))
    const links: LinkDatum[] = []

    ;(async () => {
      for (const p of papers) {
        const recs = await getRecommendations(p.id, 5)
        recs.forEach(r => {
          if (!nodes.find(n => n.id === r.paperId)) {
            nodes.push({ id: r.paperId, title: r.title })
          }
          links.push({ source: p.id, target: r.paperId })
        })
      }

      const simulation = d3
        .forceSimulation(nodes as any)
        .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-250))
        .force('center', d3.forceCenter(width / 2, height / 2))

      const link = svg
        .append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke-width', 1.5)

      const node = svg
        .append('g')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', 6)
        .attr('fill', '#1976d2')
        .call(
          d3
            .drag<SVGCircleElement, NodeDatum>()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended)
        )
        .append('title')
        .text(d => d.title)

      simulation.on('tick', () => {
        link
          .attr('x1', d => (d as any).source.x)
          .attr('y1', d => (d as any).source.y)
          .attr('x2', d => (d as any).target.x)
          .attr('y2', d => (d as any).target.y)

        node
          .attr('cx', d => (d as any).x)
          .attr('cy', d => (d as any).y)
      })

      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      }
      function dragged(event: any) {
        event.subject.fx = event.x
        event.subject.fy = event.y
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers.map(p => p.id).join(',')])

  return <svg ref={svgRef}></svg>
}
