const normalizeLongitude = (longitude) => {
    if (!Number.isFinite(longitude)) return longitude;
    const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
    return normalized === -180 && longitude > 0 ? 180 : normalized;
};

const unwrapTrackLongitudes = (points) => {
    if (points.length < 2) {
        return points.map(point => ({
            ...point,
            longitude: normalizeLongitude(point.longitude),
        }));
    }

    const unwrapped = [];
    let previousLongitude = normalizeLongitude(points[0].longitude);
    unwrapped.push({...points[0], longitude: previousLongitude});

    for (let i = 1; i < points.length; i += 1) {
        let longitude = normalizeLongitude(points[i].longitude);
        while (longitude - previousLongitude > 180) longitude -= 360;
        while (longitude - previousLongitude < -180) longitude += 360;
        unwrapped.push({...points[i], longitude});
        previousLongitude = longitude;
    }

    return unwrapped;
};

const findAntimeridianCrossing = (fromLongitude, toLongitude) => {
    if (!Number.isFinite(fromLongitude) || !Number.isFinite(toLongitude)) return null;
    if (fromLongitude === toLongitude) return null;

    if (toLongitude > fromLongitude) {
        const boundary = Math.floor((fromLongitude + 180) / 360) * 360 + 180;
        if (boundary > fromLongitude && boundary < toLongitude) {
            return {boundary, direction: 1};
        }
        return null;
    }

    const boundary = Math.ceil((fromLongitude - 180) / 360) * 360 - 180;
    if (boundary < fromLongitude && boundary > toLongitude) {
        return {boundary, direction: -1};
    }
    return null;
};

const interpolateRoutePoint = (fromPoint, toPoint, ratio, longitude) => ({
    longitude,
    latitude: fromPoint.latitude + ((toPoint.latitude - fromPoint.latitude) * ratio),
});

const splitTrackByAntimeridian = (points) => {
    const validPoints = points.filter(point => (
        Number.isFinite(point.longitude) && Number.isFinite(point.latitude)
    ));
    if (validPoints.length < 2) return [];

    const segments = [];
    let current = [{...validPoints[0], longitude: normalizeLongitude(validPoints[0].longitude)}];

    for (let i = 1; i < validPoints.length; i += 1) {
        const previousPoint = validPoints[i - 1];
        const point = validPoints[i];
        const crossing = findAntimeridianCrossing(previousPoint.longitude, point.longitude);

        if (crossing) {
            const ratio = (crossing.boundary - previousPoint.longitude)
                / (point.longitude - previousPoint.longitude);
            const boundaryPoint = interpolateRoutePoint(
                previousPoint,
                point,
                ratio,
                crossing.boundary,
            );
            current.push({
                ...boundaryPoint,
                longitude: crossing.direction > 0 ? 180 : -180,
            });
            if (current.length >= 2) segments.push(current);
            current = [{
                ...boundaryPoint,
                longitude: crossing.direction > 0 ? -180 : 180,
            }];
        }

        current.push({...point, longitude: normalizeLongitude(point.longitude)});
    }

    if (current.length >= 2) segments.push(current);
    return segments;
};

const toRoutePoint = (point) => {
    const longitude = Number(point?.longitude);
    const latitude = Number(point?.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return {longitude, latitude};
};

export const buildRouteLineGeoJson = (points = []) => {
    const validPoints = unwrapTrackLongitudes(points.map(toRoutePoint).filter(Boolean));
    if (validPoints.length < 2) {
        return {type: 'FeatureCollection', features: []};
    }

    const coordinates = splitTrackByAntimeridian(validPoints).map(segment => (
        segment.map(point => [point.longitude, point.latitude])
    ));

    return {
        type: 'FeatureCollection',
        features: coordinates.length ? [{
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiLineString',
                coordinates,
            },
        }] : [],
    };
};

export const getUnwrappedRouteCoordinates = (points = []) => (
    unwrapTrackLongitudes(points.map(toRoutePoint).filter(Boolean))
        .map(point => [point.longitude, point.latitude])
);
