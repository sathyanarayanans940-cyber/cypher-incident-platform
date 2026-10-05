"""Connected-component detector for the simulator's controlled visual domain."""
from PIL import Image


def components(mask, width, height, minimum=8):
    remaining = bytearray(mask)
    found = []
    for start in range(width * height):
        if not remaining[start]:
            continue
        remaining[start] = 0
        todo, points = [start], []
        while todo:
            index = todo.pop()
            x, y = index % width, index // width
            points.append((x, y))
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    nxt = ny * width + nx
                    if remaining[nxt]:
                        remaining[nxt] = 0
                        todo.append(nxt)
        if len(points) >= minimum:
            xs, ys = zip(*points)
            found.append({"x": min(xs), "y": min(ys), "w": max(xs) - min(xs) + 1,
                          "h": max(ys) - min(ys) + 1, "points": points})
    return found


def inspect_frame(frame: Image.Image, history: list):
    width, height = frame.size
    pixels = list(frame.getdata())
    # Pale environment, medium-dark people, dark objects: valid only for our
    # illustrated input domain, not a production weapon-recognition model.
    people_mask = [75 <= max(p) <= 150 and max(p) - min(p) < 65 for p in pixels]
    object_mask = [max(p) < 70 for p in pixels]
    people = [c for c in components(people_mask, width, height, 65) if c["h"] > 12 or c["w"] > 30]
    objects = components(object_mask, width, height, 12)
    people.sort(key=lambda c: c["x"])
    centers = [(c["x"] + c["w"] / 2) / width for c in people]
    history.append(centers)
    del history[:-12]
    moving = len(history) > 1 and bool(centers) and bool(history[0]) and abs(centers[0] - history[0][0]) > .018
    approaching = (moving and len(centers) >= 2 and len(history[0]) >= 2
                   and (centers[1] - centers[0]) < (history[0][1] - history[0][0]) - .025)

    def detection(kind, score, c):
        return {"asset_type": kind, "confidence": score,
                "bounding_box": {"x": c["x"] / width, "y": c["y"] / height,
                                 "width": c["w"] / width, "height": c["h"] / height}}

    detections = [detection("person", .96, c) for c in people]
    priority, rule, summary, asset, kind, score, box = "SAFE", "normal_movement", "Normal movement; no dangerous object detected", "PERSON", "OTHER", .96, {}
    explanation = [f"{len(people)} person silhouette(s) located", "Motion observed" if moving else "Collecting motion samples"]
    for obj in objects:
        w, h = obj["w"], obj["h"]
        columns = [sum(1 for x, _ in obj["points"] if x == obj["x"] + i) for i in range(w)]
        right = sum(columns[-max(2, w // 6):]) / max(2, w // 6)
        middle = max(columns)
        tapered = right < middle * .5
        density = len(obj["points"]) / (w * h)
        if w / h >= 2.1 and tapered:
            asset, score = "KNIFE", round(min(.98, .83 + (1 - right / middle) * .15), 2)
            priority = "CRITICAL" if approaching else "HIGH"
            rule = "sharp_object_approaching_person" if approaching else "sharp_object_held"
            summary = "Knife-shaped object; person approaching another person" if approaching else "Knife-shaped object held by a person"
            explanation += [f"Elongated object ({w / h:.1f}:1) with a tapered point", "Distance between people is decreasing" if approaching else "No directed approach confirmed"]
            kind = "THREAT"
        elif h > w * 1.35 and density < .89:
            detections.append(detection("bottle", .93, obj))
            explanation.append("Rounded upright object; bottle shape, no sharp point")
            continue
        elif h > w * 1.3 and density >= .89:
            detections.append(detection("phone", .92, obj))
            explanation.append("Compact rectangular object; phone shape, no blade")
            continue
        elif w / h >= 2:
            asset, score, priority, kind, rule = "UNKNOWN_OBJECT", .68, "MEDIUM", "OTHER", "ambiguous_object"
            summary = "Elongated object with an unclear tip; operator review needed"
            explanation.append("Elongated silhouette without enough evidence to classify as a knife")
        else:
            if people:
                detections.append(detection("bag", .90, obj))
                explanation.append("Compact bag-shaped object; no sharp point")
                continue
            asset, score, priority, kind, rule = "BAG", .76, "MEDIUM", "OTHER", "unattended_object"
            summary = "Bag-shaped object with no person nearby"
            explanation.append("Bag silhouette remains without a nearby person")
        d = detection(asset.lower(), score, obj)
        detections.append(d)
        box = d["bounding_box"]
        break
    fallen = next((p for p in people if p["w"] > p["h"] * 1.3), None)
    if fallen and priority == "SAFE":
        priority, kind, asset, score, rule = "HIGH", "HEALTH", "PERSON", .95, "fallen_person"
        summary = "Horizontal person silhouette; possible fall requiring assistance"
        explanation.append("Person's width exceeds height; fallen posture persists across frames")
        box = detection("person", score, fallen)["bounding_box"]
    if not people and not objects:
        priority, kind, asset, score, rule = "LOW", "OTHER", "CAMERA", .4, "empty_or_obscured_frame"
        summary = "Camera view empty or obscured; check camera coverage"
        explanation = ["No usable person or object silhouette in the frame"]
    incident = None if priority == "SAFE" else {"incident_type": kind, "asset_type": asset,
        "confidence": score, "priority": priority, "summary": summary, "bounding_box": box, "rule": rule}
    return {"detections": detections, "incident": incident, "priority": priority,
            "explanation": explanation, "summary": summary, "motion": {"moving": moving, "approaching": approaching},
            "score_type": "geometric-match", "frame_count": len(history)}
