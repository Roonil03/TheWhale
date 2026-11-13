// Generate the site's static whale study with fogleman/ln's hidden-line renderer.
package main

import (
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/fogleman/ln/ln"
)

type specimenSphere struct{ *ln.Sphere }

func (sphere specimenSphere) Paths() ln.Paths {
	var paths ln.Paths
	for index, path := range sphere.Sphere.Paths() {
		if index%3 == 0 {
			paths = append(paths, path)
		}
	}
	return paths
}

func main() {
	scene := ln.Scene{}
	// Ellipsoids give the specimen a rounded body, flippers, and two tail lobes.
	add := func(center, scale ln.Vector) {
		matrix := ln.Scale(scale).Translate(center)
		scene.Add(ln.NewTransformedShape(specimenSphere{ln.NewSphere(ln.Vector{}, 1)}, matrix))
	}
	add(ln.Vector{0, 0, 0}, ln.Vector{2, .85, .95})
	add(ln.Vector{1.8, 0, .2}, ln.Vector{.8, .35, .4})
	add(ln.Vector{2.4, .45, .5}, ln.Vector{.65, .55, .15})
	add(ln.Vector{2.4, -.45, .5}, ln.Vector{.65, .55, .15})
	add(ln.Vector{-.3, -.75, -.4}, ln.Vector{.8, .45, .15})
	add(ln.Vector{-1, 0, 1.3}, ln.Vector{.07, .07, .55})
	add(ln.Vector{-1.2, 0, 1.85}, ln.Vector{.3, .1, .09})
	add(ln.Vector{-.8, 0, 1.85}, ln.Vector{.3, .1, .09})
	paths := scene.Render(ln.Vector{-5, -8, 5}, ln.Vector{.3, 0, 0}, ln.Vector{0, 0, 1}, 900, 420, 38, .1, 100, .025)
	output := "../../public/whale-blueprint.svg"
	paths.WriteToSVG(output, 900, 420)
	// Raster fallback for social crawlers that cannot display SVG previews.
	paths.WriteToPNG("../../public/og.png", 900, 420)
	data, err := os.ReadFile(output)
	if err != nil {
		panic(err)
	}
	svg := strings.ReplaceAll(string(data), "black", "#233f67")
	// Subpixel precision is sufficient at the illustration's display size.
	numbers := regexp.MustCompile(`-?\d+\.\d+`)
	svg = numbers.ReplaceAllStringFunc(svg, func(value string) string {
		number, _ := strconv.ParseFloat(value, 64)
		return strconv.FormatFloat(number, 'f', 1, 64)
	})
	if err := os.WriteFile(output, []byte(svg), 0644); err != nil {
		panic(err)
	}
}
