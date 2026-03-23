using UnityEngine;

public class TopBeamPulse : MonoBehaviour
{
    [Header("Impuls")]
    public float pulseSpeed = 4f;
    public Transform pulseObject;
    public Transform[] pathPoints;

    public float flashInterval = 2f;
    public float flashDuration = 0.1f;
    public float flashScale = 2.5f;

    [Header("Glow ścieżki")]
    public float glowRadius = 0.1f;  // jak szeroki odcinek świeci
    public float maxGlowAlpha = 0.1f; // max jasność podświetlonego fragmentu

    private LineRenderer _line;
    private float _t;

    private float _flashTimer;
    private float _flashActiveTimer;
    private bool _isFlashing;
    private Vector3 _baseScale;

    void Start()
    {
        _line = GetComponent<LineRenderer>();
        _line.startWidth = 0.04f;
        _line.endWidth = 0.04f;
        _line.colorGradient = new Gradient();

        _baseScale = pulseObject.localScale;
        _flashTimer = Random.Range(0.5f, flashInterval);

        UpdatePathGlow();
    }

    void Update()
    {
        if (pathPoints == null || pathPoints.Length < 2) return;

        float totalT = _t * (pathPoints.Length - 1);
        int idx = Mathf.Clamp(Mathf.FloorToInt(totalT), 0, pathPoints.Length - 2);
        float localT = totalT - idx;

        pulseObject.position = Vector3.Lerp(
            pathPoints[idx].position,
            pathPoints[idx + 1].position,
            localT
        );

        _t = Mathf.Repeat(_t + Time.deltaTime * (pulseSpeed / pathPoints.Length), 1f);
        HandleFlash();
    }

    void UpdatePathGlow()
    {
        if (pathPoints == null || pathPoints.Length < 2) return;

        _line.positionCount = pathPoints.Length;
        for (int i = 0; i < pathPoints.Length; i++)
            _line.SetPosition(i, pathPoints[i].position);

        Gradient gradient = new Gradient();
        gradient.SetKeys(
            new GradientColorKey[] {
                new GradientColorKey(new Color(0f, 0.7f, 1f), 0f),
                new GradientColorKey(new Color(0f, 0.7f, 1f), 1f)
            },
            new GradientAlphaKey[] {
                new GradientAlphaKey(0.4f, 0f),
                new GradientAlphaKey(0.4f, 1f)
            }
        );
        _line.colorGradient = gradient;
    }

    void HandleFlash()
    {
        _flashTimer -= Time.deltaTime;
        if (_flashTimer <= 0)
        {
            _isFlashing = true;
            _flashActiveTimer = flashDuration;
            _flashTimer = Random.Range(0.5f, flashInterval);
        }

        if (_isFlashing)
        {
            _flashActiveTimer -= Time.deltaTime;
            if (_flashActiveTimer <= 0)
                _isFlashing = false;
        }

        // Płynne rozświetlanie i przygasanie
        float targetScale = _isFlashing ? flashScale : 1f;
        float currentScale = pulseObject.localScale.x / _baseScale.x;
        float smoothScale = Mathf.Lerp(currentScale, targetScale, Time.deltaTime * 8f);
        pulseObject.localScale = _baseScale * smoothScale;
    }
}