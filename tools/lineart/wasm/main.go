//go:build js && wasm

package main

import (
    "fmt"
    "strings"
    "syscall/js"
    "github.com/fogleman/ln/ln"
)

type sparseSphere struct{ *ln.Sphere }
func (s sparseSphere) Paths() ln.Paths {
    var result ln.Paths
    for i, path := range s.Sphere.Paths() { if i % 3 == 0 { result = append(result, path) } }
    return result
}
func render(this js.Value, args []js.Value) interface{} {
    scene := ln.Scene{}
    add := func(center, scale ln.Vector) { scene.Add(ln.NewTransformedShape(sparseSphere{ln.NewSphere(ln.Vector{}, 1)}, ln.Scale(scale).Translate(center))) }
    add(ln.Vector{0,0,0}, ln.Vector{2,.85,.95})
    add(ln.Vector{1.8,0,.2}, ln.Vector{.8,.35,.4})
    add(ln.Vector{2.4,.45,.5}, ln.Vector{.65,.55,.15})
    add(ln.Vector{2.4,-.45,.5}, ln.Vector{.65,.55,.15})
    add(ln.Vector{-.3,-.75,-.4}, ln.Vector{.8,.45,.15})
    add(ln.Vector{-1,0,1.3}, ln.Vector{.07,.07,.55})
    add(ln.Vector{-1.2,0,1.85}, ln.Vector{.3,.1,.09})
    add(ln.Vector{-.8,0,1.85}, ln.Vector{.3,.1,.09})
    paths := scene.Render(ln.Vector{-5,-8,5}, ln.Vector{.3,0,0}, ln.Vector{0,0,1}, 900,420,38,.1,100,.04)
    var lines []string
    for _, path := range paths {
        var coords []string
        for _, v := range path { coords = append(coords, fmt.Sprintf("%.1f,%.1f", v.X, v.Y)) }
        if len(coords) > 1 { lines = append(lines, strings.Join(coords, " ")) }
    }
    return strings.Join(lines, "\n")
}
func main() { js.Global().Set("renderWhale", js.FuncOf(render)); select {} }
